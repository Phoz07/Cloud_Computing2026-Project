# (B) วิเคราะห์ 6 เสาหลัก — AWS Well-Architected

สีของเสา: OpEx=ฟ้า · Perf=ส้ม · Reliability=เขียวสด · Sustainability=เขียวอมฟ้า · Security=เทาเข้ม · Cost=ม่วง

## B.1 Operational Excellence (ฟ้า)

- ความหมายในโปรเจกต์นี้: ระบบให้ระดับ Ops ที่ทำให้ทีมเล็ก (1 คน) จัดการ microservices บน EKS ได้ทุกวันโดยไม่กลายเป็นงาน manual
- ทำได้จริง: Terraform root เดียวทั้ง infra (apply/destroy ซ้ำได้) · Helm chart เดียวใช้ทั้ง k3d และ EKS · make deploy = build 7 images + 4 Secrets + migrate hook · CI 3 jobs (check / images / deploy) ใน .github/workflows/ci.yml
- หลักฐานผลจริง: EKS GATE 2026-10-24 สร้างคลัสเตอร์จากศูนย์และ deploy สำเร็จ; k3d parity GATE ผ่าน; db-migrate hook รันก่อน rollout ทุก deploy
- ตรงกับหลัก AWS: Operate as code · Frequent, small, reversible changes · Anticipate failure
- ช่องว่าง: ไม่มี alerting/runbook ตอนเกิดเหตุ · Container Insights opt-in ยังไม่ยืนยันสถานะ · ไม่มี rollback rehearsal (helm --atomic ไม่ได้ตรวจ)
- ระดับความมั่นใจ: **ครบถ้วน** (ในระดับโปรเจกต์เรียน)

## B.2 Performance Efficiency (ส้ม)

- ความหมาย: รองรับผู้ใช้พร้อมกันด้วย cache, autoscale, และทางเลือก runtime ที่เบา
- ทำได้จริง + ตัวเลข: HPA 2→8 pods (ครบวงจร กลับเป็น 2) · k6 98,500 requests, 226.4 req/s, p95 430.6 ms, ผ่าน 99.89% · Redis cache (event detail 5 นาที, session introspect 60 วินาที) · WebSocket live seats (recount ทุก 250 ms + resync 30 วินาที) · Bun compile รูปเล็ก
- ตรงกับหลัก AWS: Match supply with demand · "Stop guessing capacity" (ประมาณจำนวน pod/node 30+ ก่อน แล้ววัดจริงด้วย k6)
- ช่องว่าง: load test กระแสหลักเฉพาะ read path /api/events ยังไม่ทดลอง booking path · ไม่มี CDN · Redis ไม่ได้ persist
- ระดับความมั่นใจ: **ครบถ้วน** (มีตัวเลขเอาไว้โต้แย้งได้)

## B.3 Reliability (เขียวสด)

- ความหมาย: ระบบต้องกู้คืนได้ เมื่อ pod ตาย/hold หมดอายุ/เมลล้มโดยไม่มีคนกดปุ่ม
- ทำได้จริง: node กระจาย 3 AZ · HPA · NLB L4 · liveness probe ห้ามแตะ DB (กัน DB blip ทำ pod รีสตาร์ททั้งเว็บ) · SQS retry + DLQ (5 ครั้ง) · effectiveStatus() อ่านสดทำที่นั่งคืนทันทีโดยไม่ต้องมี cron · Stripe verify ใช้ตอนเสีย webhook (self-heal) · nightly rebuild = ซ้อม recovery ทุกวัน
- ตรงกับหลัก AWS: Automatically recover · Test recovery procedures (rebuild จากศูนย์ทุก session คือ rehearsal) · Horizontal scaling
- ช่องว่าง (พูดตรง): RDS multi_az=false และ backup=0 · ไม่มี Chaos Testing / kill instance / บังคับ DB failover · ไม่มี RTO/RPO · Redis เดี่ยวไม่มี HA
- ระดับความมั่นใจ: **บางส่วน** — กลไกอยู่ แต่การพิสูจน์ด้วยการทำลายระบบยังหายไป

## B.4 Sustainability (เขียวอมฟ้า)

- ความหมาย: บริโภค resource เฉพาะเท่าที่จำเป็น — ที่นี่พิสูจน์ด้วยการทำลายเมื่อไม่ใช้
- ทำได้จริง: make down จบทุกเซสชัน (platform อยู่เฉพาะตอนใช้) · node เล็กที่สุดที่พอ (t3.small) · HPA ย่อลงเมื่อโหลดลด (evidence กลับ 8→2) · dev ใช้ k3d + MinIO + ElasticMQ ในเครื่อง ไม่กิน AWS เวลาไม่デモ · รูป images เล็ก (Bun slim/compile) ลดแบนด์วิดท์ push
- ตรงกับหลัก AWS: Match supply with demand · Maximize utilization · Sustainable building blocks
- ช่องว่าง: ไม่มี automation ตั้งเวลา teardown · ไม่วัดและรายงานเมตริก sustainability · region us-east-1 (ไม่วิเคราะห์ปริมาณ carbon)
- ระดับความมั่นใจ: **บางส่วน** — อนุรักษ์ด้วยการจัดการต้นทุนเป็นหลัก ยังไม่มีเมตริก

## B.5 Security (เทาเข้ม)

- ความหมาย: identity + การแบ่งสิทธิ์ให้ทุกบทบาท และการปิดทางเข้าที่ไม่จำเป็น
- ทำได้จริง: Better Auth cookie session + server-side introspection; การเปลี่ยนบทบาท/แบน ระงับ session ทันทีด้วย databaseHooks · RBAC (user/organizer/admin) + ownership macro (organizer แตะเฉพาะงานตนเอง) · S3 bucket policy เปิดเฉพาะ public/* (ทดสอบจริง 200/403) · RDS ต่อได้เฉพาะจาก node SG, ไม่ publicly accessible · Secrets ผ่าน Secrets Manager + k8s Secret per-service (ESO ปิด เหตุผลบันทึกไว้) · ใช้ Stripe sandbox; live key ถูกปฏิเสธถ้าไม่ prod
- ตรงกับหลัก AWS: Strong identity foundation · Least privilege · Protect data in transit (มีแผนใน dns.tf มิฉะนั้นให้เว้นว่าง)
- ช่องว่าง (ต้องพูดตรง): traffic กลุ่มหลักยัง http:// (ไม่มีโดเมน) · ไม่มี WAF/Shield/GuardDuty/X-Ray · เครดิต session ใน k8s Secret หมดอายุเอง (ค้างแบบ trade-off) · ยังไม่เปิด rate-limit ตัวนับตาม Better Auth (ต้องยืนยัน)
- ระดับความมั่นใจ: **บางส่วน** — identity/ระดับสิทธิ์แข็ง network/TLS ยัง open

## B.6 Cost Optimization (ม่วง)

- ความหมาย: ระบบทุกข้อมูลกลุ่มอยู่ใน $50 ตายตัว ต้องมีวินัยทั้งการตั้งค่าตัวเอง
- ทำได้จริง + ตัวเลข: cost model ใน SYSTEM-DESIGN §11: EKS $0.10/hr · NLB $0.023/hr · RDS $0.018/hr · 2x t3.medium $0.083/hr = ~$0.27/hr (~$3.40/วัน ถ้าเผลอลืมปิด); จริงปกติใช้ t3.small ยิ่งถูกลง; 1 เซสชัน 4 ชม. ~$1.10 · ตัด NAT gateway (เหตุผลเด่น) · ตัด Prometheus/Grafana · deploy เฉพาะตอนใช้งาน · มี ritual รัน check-lab.sh + ดูเครดิตต้นและท้ายเซสชัน
- ตรงกับหลัก AWS: Adopt consumption model · Stop spending on undifferentiated heavy lifting (RDS ตัวเดียวแทน 4, ไม่มี NAT) · Measure efficiency (รู้ตัวเลขจ่ายก่อน/หลัง)
- ช่องว่าง: ไม่มี dashboard ราคาจากทีมกลุ่มแบบ budget alert (budget ที่ยังในห้องเรียนทำไม่ได้) · ค่า forward เมื่อพลผ่านใหม่ (ถ้าติดใช้ forward จาก NLB มีข้อเรียกเก็บเพิ่ม)
- ระดับความมั่นใจ: **ครบถ้วน** — ต้นทุนถูกออกแบบเป็นตัวเลขเดิม

## B.7 ตาราง Matrix: เสา x บริการ/กลไก

| เสา | บริการ/กลไกสำคัญ | จุดแข็ง/จุดอ่อน |
|---|---|---|
| OpEx (ฟ้า) | Terraform + Helm + CI/Cron js + k3d parity | แข็ง — deploy ระดับ production-reproducible |
| Perf (ส้ม) | HPA + Redis cache + WebSocket + k6 evidence | แข็ง — มีตัวเลขกลุ้มวัดจริง |
| Reliability (เขียวสด) | probe/SQS DLQ/hold expiry/rebuild-ritual | ส่วนหนึ่ง — ระบบขยายได้แต่ **หาย chaos testing + Multi-AZ** |
| Sustainability (เขียวอมฟ้า) | make down, HPA, local dev | บางส่วน — อนุรักษ์ดี แต่ยังไม่มีเมตริก |
| Security (เทาเข้ม) | Better Auth + RBAC + S3 policy + SG | บางส่วน — app-level แข็ง, network/HTTPS ยังระงับ |
| Cost (ม่วง) | Cost model + teardown ศาสตร์ | แข็งที่สุด — ทุกตัวเลขยังในกลุ่มพิสูจน์ด้วยเลขที่วัดได้ |

สรุป: แข็งสุด = Cost และ OpEx · Perf มี evidence จริง · อ่อนสุด = Reliability (failover/chaos ยังไม่พิสูจน์) และ Sustainability (ไม่มีเมตริก) · Security ครึ่งกลาง (identity ดี, TLS ยังตัน)
