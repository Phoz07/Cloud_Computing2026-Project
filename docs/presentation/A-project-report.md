# (A) รายงานสรุปโปรเจกต์ — Eventide (as-built)

ทุกข้ออ้างอิงไฟล์จริง · ตรวจสอบวันที่ 2026-10-25

## 1. Executive Summary

- Eventide = เว็บขายตั๋วอีเวนต์แบบ microservices (Bun + ElysiaJS + React 19 + TanStack + shadcn/ui)
- 7 workloads บน Amazon EKS 1.33: auth, event, registration, payment, mail-worker, web, redis (pod)
- Edge: ingress-nginx (NodePort) + NLB ที่ Terraform สร้าง (ไม่มี CloudFront / Route 53 / ACM — ของจริงเปิดผ่าน DNS ของ NLB ทาง http)
- สภาพแวดล้อม: AWS Academy Learner Lab, us-east-1, budget $50 ตายตัว, เครดิตหมดอายุทุก 4 ชม. → destroy/rebuild ทุกเซสชัน
- ผ่าน GATE deploy จริง 2026-10-24: health × 4 "โอเค", sign-up + cookie session, S3 200/403 ตามสิทธิ์, เมลผ่าน SQS → mail-worker, make admin, HPA ทำงาน (docs/TODO.md §0.6)
- ผลทดสอบจริง: k6 = 98,500 requests, 226.4 req/s, ผ่าน 99.89%, avg 316.7 ms, p95 430.6 ms; HPA 2→3→5→7→8 แล้วกลับ 8→6→4→2 (docs/autoscaling-evidence.txt)
- ต้องพูดตรง: seed ที่ให้มา = target design ที่ยังไม่ติดตั้ง; ไม่มี Chaos Testing และไม่มีตัวเลข Availability / RTO / RPO ที่วัดจริง

## 2. ปัญหา / เป้าหมาย / ขอบเขต / บทบาท

- ปัญหา: ขายตั๋วรองรับผู้ซื้อพร้อมกันโดยไม่ขายเกินโควตา + กระบวนการอนุมัติ ชำระเงิน ตรวจตั๋ว และบทบาท admin
- เป้าหมาย infra: IaC ที่ rebuild ได้ทุกวัน + มี evidence ทดสอบ (k6, HPA) + ค่าใช้จ่ายอยู่ใต้ $50
- กลไกกันขายเกิน: ล็อกแถว ticket_types (SELECT ... FOR UPDATE) + seat_holds ใน Postgres (10 นาที) + นับ seatsTaken = active holds + active enrollments + maxPerUser
- บทบาท 4 แบบ (ตรง seed):
  - Guest = ดูเว็บสาธารณะ
  - user / Attendee = สมัครจองตั๋ว, ดูตั๋วของตนเอง, แก้ profile
  - Organizer = สร้างงาน/ตั๋ว/ฟอร์ม, เช็คอิน, dashboard — จำกัดสิทธิ์เฉพาะงานของตนเอง (macro eventOwner)
  - Admin = จัดการทุกงาน, ระงับบัญชี (ban), อนุมัติสิทธิ์ organizer
- ขอบเขตที่ตัดออก (มีเหตุผลบันทึกไว้, docs/REPORT.md §2): BFF/API gateway, Prometheus+Grafana, RDS หลาย instance, ห้องรอ/คิวรอ, CloudFront (lab deny), cert-manager

## 3. สถาปัตยกรรม (as-built)

Traffic: Browser → Terraform NLB (TCP) → ingress-nginx NodePort → แยกเส้นทางตาม prefix:
- `/` → web (SPA + Bun server ทำ Open Graph tags)
- `/api/auth` → auth (Better Auth, cookie session)
- `/api/events` → event (งาน, ticket types, OG images, Redis cache 5 นาที)
- `/api/regis` → registration (seat availability, enrollments, tickets, check-in, WebSocket live feeds)
- `/api/payment` → payment (Stripe Checkout, webhook, refunds)
- `/files/*` → Ingress เข้าดึงตรงจาก S3 (bucket policy เปิดให้อ่านเฉพาะ `public/*`)

Data / Async:
- RDS PostgreSQL db.t3.micro หนึ่ง instance หนึ่ง database `eventide` — multi_az = false, backup_retention_period = 0 (ตั้งค่าจริงใน rds.tf, ต้องพูดตรง)
- Redis pod ในคลัสเตอร์ (ไม่ใช่ ElastiCache): cache ผล get-session 60 วินาที + ช่องทาง Redis `seats:changed` เพื่อประกาศจำนวนที่นั่งสด
- SQS mail-queue + DLQ: visibility 30 s, long-poll 10 s, maxReceiveCount = 5 ก่อนขยับไป DLQ (sqs.tf)
- Migration รันผ่าน Helm pre-upgrade hook `db-migrate` ก่อน pod กลุ่มใหม่มาแทนที่เก่า

External: Stripe (checkout/webhook/refund — webhook ต้อง https ยังไม่ได้ deploy), Gmail SMTP (ไม่มี key = dry-run log)

## 4. ตารางบริการ AWS ที่ใช้จริง

| บริการ | หน้าที่ | เหตุผลที่เลือก | Config สำคัญ |
|---|---|---|---|
| EKS | รัน pods ทั้ง 7 | โจทย์บังคับ microservices + autoscaling | 1.33, node group 2 x t3.small (min 2 / max 4), raw aws_eks_* เพราะ module ชุมชนโดน lab สั่ง block |
| RDS PostgreSQL | ฐานข้อมูลกลางเดียว | ลดต้นทุนให้ต่ำกว่าเพดาน $50; ตัดสินใจแบบแยกตารางตาม domain | db.t3.micro, multi_az=false, backup=0, sslmode=require, DB_POOL_MAX=4 ต่อ pod |
| S3 | เก็บรูปงาน / ไฟล์ผู้ใช้ | โหลด bytes ไม่ผ่าน pod | bucket event-assets; policy ให้อ่านเฉพาะ public/* |
| SQS | async เมล + DLQ | ป้องกันการพังส่งเมลชะงัก; retry แล้วตัว.mock ตาม DLQ | visibility 30 s, long poll 10 s, maxReceiveCount 5 |
| ELB (NLB) | ประตูสาธารณะ | อยู่ใน Terraform state เพื่อ destroy ได้สะอาด | TCP :80 → NodePort; :443 TLS จะใช้เมื่อมีโดเมน |
| Secrets Manager | เก็บคีย์ Google / Stripe / Gmail (opt-in) | แยกข้อมูลลับออกจาก git | 3 ข้อ opt-in: google-oauth, stripe, gmail |
| ECR | เก็บ 7 images | ส่งมอบรูปเดียวกันทุก session | เปิดใช้ทุก session ผ่าน deploy.sh |
| CloudWatch | Container Insights (opt-in) | ตัด Prometheus/Grafana แล้วใช้ metric จาก HPA แทน | สลับด้วยตัวแปร Terraform; ถ้าปิดให้อ่านจาก kubectl top + HPA log |
| จาก seed ที่ไม่มีของจริง | — | — | CloudFront / Shield / WAF / EventBridge / ElastiCache / X-Ray / GuardDuty / VPC endpoints / Route 53 + ACM (ออกแบบไว้ใน dns.tf แต่ไม่ได้ deploy เพราะไม่มีโดเมน) |

## 5. เส้นทางการใช้งานหลัก (จาก AGENTS.md + docs/tickets.md)

1. ซื้อตั๋ว first_come: เปิดหน้างาน → POST /ticket-types/:id/hold เก็บที่นั่ง 10 นาที (บัญชีเดียวต่อประเภทตั๋ว ขอซ้ำได้แต่ได้ตัวเดิม) → เลือกจำนวน + กรอกฟอร์มคำถาม → enroll() ล็อกแถว ticket_types นับ seatsTaken ตัดโควตา → สถานะ pending/awaiting_payment (ถือจอง 35 นาที) → POST /checkout สร้าง Stripe Checkout session → webhook หรือ POST /checkout/verify แปลงเป็น confirmed → ออกตั๋ว (QR) และเข้าคิวเมลยืนยัน
2. ชำระเงิน → refund: คืนเงินทั้งออร์เดอร์ตาม policy percent, ยกเลิก enrollment และคืนที่นั่งทันที
3. ถ้าไม่ชำระในเวลา: สถานะอ่านสดด้วย effectiveStatus() ทุกครั้ง — ที่นั่งคืนทันทีโดยไม่ต้องมี job ตัดอายุ

## 6. การทดสอบและผลลัพธ์

| ประเมิน | ผลจริงที่มี log ยืนยัน |
|---|---|
| k6 + HPA (load test /api/events) | 98,500 requests, 226.4 req/s, pass 99.89%, avg 316.7 ms, p95 430.6 ms, 200 VUs; HPA 2→3→5→7→8 → 8→6→4→2 (autoscaling-evidence.txt) |
| EKS GATE 2026-10-24 | deploy สำเร็จจากศูนย์: 7 images, 4 Secrets, migrate hook, health x 4 "โอเค", S3 200/403, เมลผ่าน SQS จริง, make admin, HPA metrics live (docs/TODO.md §0.6) |
| bun test + CI | transaction matrix ด้าน anti-oversell / idempotency / เลื่อนตั้งเวลา (docs/TODO.md §0.5) |
| k3d parity | local cluster ทำงานได้เหมือนฝั่ง EKS เบื้องหลังเช่นเดียวกัน (docs/TODO.md §0.6) |
| Chaos Testing / kill instance / บังคับ DB failover | *ไม่มีในเอกสารทั้งโปรเจกต์* (ผมสอดสอบ docs/ ทุกชุดไม่พบ) [ไม่พบข้อมูล — แนะต้องยืนยันก่อน] |
| Availability % / RTO / RPO | ไม่มีตัวเลขถูกวัดและบันทึกไว้ [ไม่พบข้อมูล] |

