# C-canva-slides.md — ซับเท็กซ์ต่อสไลด์

14 สไลด์ / 20 นาที (~1.4 นาที/สไลด์)

## กฎการออกแบบ (อ่านก่อนลง Canva)

- **ระบายสี 6 เสา** (ใช้เหมือนกันทุกสไลด์):
  - Operational Excellence = ฟ้า `#1F7BC0`
  - Performance Efficiency = ส้ม `#E8830C`
  - Reliability = เขียวสด `#2E9E3E`
  - Sustainability = เขียวอมฟ้า `#1FA88A`
  - Security = เทาเข้ม `#3D4451`
  - Cost Optimization = ม่วง `#7B4FD0`
- สไลด์เสา 1 ต้น = ไฮไลต์เฉพาะ "ชิ้นสถาปัตยกรรมที่เกี่ยวข้อง" ด้วยเส้นขอบ/ป้ายสีเสานั้น ส่วนที่เหลือของไดอะแกรมหรี่ลง (ความสว่าง ~40%) — ไม่วาดใหม่ ใช้ไดอะแกรม as-built ชุดเดียวซ้ำทุกสไลด์
- หลักภาพ: 1 ภาพหลัก + ไอคอน ≤4 ต่อสไลด์ · ภาพ evidence จริงมาก่อน stock
- ตัวเลขทุกตัวมีแหล่งที่มาระบุไว้แล้ว ห้ามแต่งเพิ่ม `[ไม่พบข้อมูล]` ใช้เมื่อไม่มีจริง
- ฟอนต์ไทย: Google Sans Thai / Sarabun หัวข้อใหญ่ ตัวเลขเด่น

---

## สไลด์ 1/14 — หน้าปก (~0.5 นาที)

**Headline:** Eventide · ระบบขายตั๋วงานบน AWS (EKS + Terraform)

**Body:**
- ชื่อทีม / รายชื่อสมาชิก / ภาควิชา IT KMITL
- รายวิชา Cloud Computing 2026
- ตัวเลขสรุปบนปก: 1 คลัสเตอร์ EKS · 4 microservices · $50 cap

**Key number:** 7 images บน ECR · 1 คลัสเตอร์ EKS

**Speaker notes:**
เปิดด้วยประโยคเดียว: "Eventide คือเว็บขายตั๋วจริงที่ deploy บน EKS ด้วย Terraform ทั้งหมด ภายใต้งบ $50 ของ Learner Lab" ย้ำว่าทุกอย่างในสไลด์ต่อไปคือของจริงที่รันผ่าน ไม่ใช่แผนภาพ

**คำถามกรรมการที่ควรเตรียม:** ทำไมเลือก EKS ไม่ใช้ ECS/Lambda? — ตอบ: เป้าหมายเรียนรู้ Kubernetes เต็มรูปแบบ + lab ให้ create cluster ได้ (ดู docs/PROJECT-KNOWLEDGE-BASE.md)

🖼️ **Visual Plan**
| ตำแหน่ง | ประเภท | เนื้อหา | แหล่ง | ขนาด | แคปชัน | สถานะ |
|---|---|---|---|---|---|---|
| ครึ่งขวา | ภาพหลัก | หน้าจอเว็บจริง | `docs/screenshots/01-home.png` | ~50% ของสไลด์ | "หน้าเว็บจริง ทำงานบน EKS" | พร้อมใช้ |
| มุมซ้ายบน | โลโก้/ไอคอน | Eventide logo | วาดใน Canva | เล็ก | — | ต้องวาดใหม่ |
| แถบล่าง | ไอคอน 3 ตัว | k8s, AWS, Terraform | Canva elements | เล็ก | — | วาดใน Canva |

---

## สไลด์ 2/14 — ปัญหาและโซลูชัน (~1.5 นาที)

**Headline:** ขายตั๋วต้องไม่ซ้ำ ไม่หาย และคุ้มตังค์

**Body:**
- ปัญหาขายตั๋ว: overbook, โกงจ่าย, ตึงระบบตอนรัชชั่วโมง
- 3 บทบาท: user / organizer / admin (จัดงานได้เฉพาะของตัวเอง)
- ควบคุมที่นั่งด้วย row lock + seat hold ใน Postgres
- จ่ายผ่าน Stripe, ส่งเมลผ่าน SQS queue
- 4 microservices แยก process, คุยกันผ่าน HTTP + cookie session

**Key number:** 3 ชนิดตั๋ว: first_come · approval · invite

**Speaker notes:**
เล่าปัญหาแบบเล่าเรื่อง: "ขายตั๋วงานผิดพลาดแค่จุดเดียวคือตั๋วเกิน — Eventide กันที่จุดที่ยากที่สุดคือการ enroll โดยล็อกแถว ticket_types ก่อนนับที่นั่งเสมอ" ชี้ว่าโดเมนแยกชัด (auth 3001 / event 3002 / regis 3003 / payment 3004)

**คำถามกรรมการ:** กัน oversell ยังไง? — ตอบ: `SELECT … FOR UPDATE` บนแถว ticket_types ใน transaction + ตาราง seat_holds (AGENTS.md §Tickets)

🖼️ **Visual Plan**
| ตำแหน่ง | ประเภท | เนื้อหา | แหล่ง | ขนาด | แคปชัน | สถานะ |
|---|---|---|---|---|---|---|
| ซ้ายกลาง | ภาพหลัก | 3 การ์ดบทบาท user/organizer/admin | Canva | ~35% | "3 บทบาท 4 สิทธิ์" | วาดใน Canva |
| ขวาบน | ภาพจริง | screenshot รายการตั๋ว 3 ชนิด | `docs/screenshots/03-event-detail.png` | ~30% | "สินค้า 3 ชนิดต่างกันที่กติกา" | พร้อมใช้ |
| กรอบล่าง | ไอคอน | lock, clock, ticket, mail | Canva | เล็ก | — | วาดใน Canva |

---

## สไลด์ 3/14 — ข้อจำกัด Learner Lab (~1.5 นาที)

**Headline:** ตีขอบ $50: เล่นตามกฎของ lab

**Body:**
- งบ $50 เข้มงวด — เกินคือระงับบัญชี ลบงานทั้งหมด
- session ละ ~$1.10 · ต้อง `make down` ทุกครั้งที่เลิกใช้
- IAM ถูกปฏิเสธ: สร้าง IAM Role / OIDC / CloudFront ไม่ได้
- ไม่มี NAT gateway — ใช้ default VPC ตรง ๆ (public subnet)
- ทุกข้อจำกัด probe ด้วยสคริปต์ `check-lab.sh` ไม่กดโดยการันตรี

**Key number:** $1.10 / session · $50 cap

**Speaker notes:**
สไลด์นี้ป้องกันทุกคำถาม "ทำไมไม่ใช้ X" — X คือ O จากการทดลองจริง (docs/lab-probe-2026-09-0{6,7}.txt) เช่น CloudFront ถูก deny จาก SCP ของ org, สร้าง IAM role ไม่ได้เลยต้อง reuse LabEksClusterRole ที่ lab ให้มา ย้ำหลักการ: infrastructure ไม่ยืดหยุ่นตาม deadline, ฟีเจอร์ตัดได้

**คำถามกรรมการ:** ถ้าเป็น production ต้องเติมอะไร? — ตอบ: IRSA, NAT gateway, CloudFront, Route53+ACM (วาดไว้แล้วใน dns.tf แต่ไม่มีโดเมนจริง)

🖼️ **Visual Plan**
| ตำแหน่ง | ประเภท | เนื้อหา | แหล่ง | ขนาด | แคปชัน | สถานะ |
|---|---|---|---|---|---|---|
| ซ้าย | ตัวเลขใหญ่ | "$50" เด่นที่สุดของสไลด์ | Canva text | ~40% สูง | "งบเพดาน" | วาดใน Canva |
| ขวา | ตาราง 2 คอลัมน์ | "อยากใช้ → ข้อจำกัดจริง" 5 แถว | Canva จาก lab-probe | ~50% | "จากการ probe จริง" | วาดใน Canva |
| ภาพรอง | screenshot | หน้า learner lab (ถ้ามีถ่ายไว้) | ถ่ายเอง/Canva | เล็ก | — | ต้องแคปเพิ่ม |

---

## สไลด์ 4/14 — สถาปัตยกรรม As-Built (~2 นาที) ★สไลด์แกน

**Headline:** แผนที่จริง: เทอร์ราฟอร์ม → EKS → RDS/S3/SQS

**Body:**
- Terraform 1 root: NLB + EKS + RDS + SQS + ECR + S3
- 7 images: web, auth, event, regis, payment, mail-worker, migrate
- traffic ทาง NLB → ingress-nginx → Ingress 2 ชุด (API / files→S3)
- Redis + Postgres เป็น pod/บริการแยกภายในคลัสเตอร์
- CI: push ไป main → GitHub Actions → ECR → helm upgrade

**Key number:** 7 ECR repos · 1 NLB · 1 RDS `db.t3.micro`

**Speaker notes:**
ใช้ไดอะแกรม as-built เป็นภาพหลักและใช้ต่อในทุกสไลด์เสา (ไฮไลต์ชิ้นส่วนที่เกี่ยวข้องในขณะที่ชิ้นส่วนอื่นสลัว) เน้น "ทุก daemon ในแผนภาพมีไฟล์ .tf รองรับ" หยิบจุดแข็ง: ออกแบบตามข้อจำกัด — NLB ต้องสร้างโดย Terraform เพราะ Service แบบ LoadBalancer จะ orphan นอกสเตต

**คำถามกรรมการ:**
- ทำไมไม่แยก RDS ต่อ service? — ทั้ง schema เป็น FK เดียวกัน + db.t3.micro ต่อ ~87 connections (docs/REPORT.md §2)
- Session ซ้ายที่ pod ตายไหม? — auth-guard เรียก get-session แล้ว cache Redis 60s

🖼️ **Visual Plan**
| ตำแหน่ง | ประเภท | เนื้อหา | แหล่ง | ขนาด | แคปชัน | สถานะ |
|---|---|---|---|---|---|---|
| เต็มพื้น | ภาพหลัก | ไดอะแกรม as-built เต็มสไลด์ | `docs/architecture/aws/eventide-aws-as-built.png` | ~70% | "As-Built 2026-10-24" | พร้อมใช้ ★ |
| มุมขวาล่าง | สติกเกอร์ | Terraform + Helm + k8s | Canva | เล็ก | — | วาดใน Canva |

---

## สไลด์ 5/14 — แผนที่ 6 เสา W-A (~1 นาที)

**Headline:** ตรวจ 6 เสา: แข็งไหน กร่อนไหน

**Body:**
- 6 เสา: OpEx · Perf · Reliability · Sustainability · Security · Cost
- จัดกลุ่ม: แข็งแรง (Cost, OpEx) / ยังบอกได้บางส่วน (Perf, Security, Sustainability) / อ่อน (Reliability)
- สไลด์ต่อไป 6 หน้า = 1 เสา 1 หน้า ใช้รูปแบบเดียวกัน
- ทุกข้อความอ้างอิงไฟล์จริงใน repo

**Key number:** 6 เสา · 18+ ตารางหลักฐาน

**Speaker notes:**
สไลด์บูรณาการก่อนเจาะ — บอกกรรมการว่า "เราให้คะแนนตัวเองตามหลักฐาน ไม่ใช่ความรู้สึก" ให้เห็นสีแล้ว รู้ลำดับที่กำลังจะเจอ แสดงเมทริกซ์เล็กถ้ามีที่ว่าง

🖼️ **Visual Plan**
| ตำแหน่ง | ประเภท | เนื้อหา | แหล่ง | ขนาด | แคปชัน | สถานะ |
|---|---|---|---|---|---|---|
| แนวนอนกลาง | ภาพหลัก | ธรรมดา 6 เสา: วาดเสา 6 ต้นเรียงสี 6 สีเรียงสี, ติด % ของเสาแข็ง | Canva | ~60% | "คะแนนจากหลักฐาน" | วาดใน Canva ★ |
| ใต้เสา | text | ติด tag สั้นบนแต่ละเสา: "ระบบอัตโนมัติเต็ม" / "ทดสอบจริง k6" / "ไม่มี DR" / "on-demand 41%" / "IAM+เข้มแต่ไม่มี WAF" / "ตัดฟีเจอร์เก็บเงิน" | Canva | เล็ก | — | วาดใน Canva |

---
## สไลด์ 6/14 - Operational Excellence (ฟ้า #1F7BC0) (~1.4 นาที)

**Headline:** ทำซ้ำได้ทั้งระบบ ไม่ต้องมีทีม ops

**Body:**
- ทั้งแพลตฟอร์มเป็น Terraform code เดียว สร้าง/ลบด้วย make up / make down
- deploy = make deploy เดียว: สร้าง 7 images, แทน k8s Secrets, helm upgrade
- migrate รันก่อน pods ทุกครั้ง ผ่าน pre-upgrade hook ในเชิงติดตั้ง (chart)
- CI: test + build ทุก PR, push main จะ deploy เอง (env หมดอายุก็ข้ามอย่างปลอดภัย)
- ช่องว่าง: ไม่มี runbook ที่เป็นทางการ [ไม่พบข้อมูล - ต้องยืนยัน]

**Key number:** 1 คำสั่ง deploy · 7 images ทุกครั้ง

**Speaker notes:**
หัวใจของเสานี้คือ "ผู้ดูแลทีมเดียวทำซ้ำได้" ทุกขั้นตอนเป็น code ที่อ่านได้จาก git: terraform สำหรับแพลตฟอร์ม, helm สำหรับ pods, Makefile เป็น UI ของมนุษย์ ถ้ากรรมการถามเรื่อง incident - ตอบว่ายังไม่มี runbook และไม่ยอมแต่งเรื่อง

**คำถามกรรมการที่ควรเตรียม:** deploy ได้ไหมถ้าลืม make down? - ตอบ: ได้ แต่ค่าระบบยังคงจ่าย session ต่อ, CI deploy ยังช่วยให้ระบบกลับมาได้

**รูปภาพ - Visual Plan**
| ตำแหน่ง | ประเภท | เนื้อหา | แหล่ง | ขนาด | แคปชัน | สถานะ |
|---|---|---|---|---|---|---|
| ขวากลาง | ภาพหลัก | terminal แสดง make deploy สำเร็จ | แคปจาก commit log / terminal | 45% | "1 คำสั่ง ทั้งเคลสเตอร์" | ต้องแคปเพิ่ม |
| ใต้ภาพหลัก | ไอคอน | Terraform, Helm, GitHub | canva elements | เล็ก | - | วาดใน canva |

---

## สไลด์ 7/14 - Performance Efficiency (ส้ม #E8830C) (~1.4 นาที)

**Headline:** รับกระแส 226 req/s บนของเดิม

**Body:**
- k6 load test: 98,500 requests, 226.4 req/s, p95 = 430.56 ms
- HPA อัตโนมัติ 2 -> 3 -> 5 -> 7 -> 8 เมื่องานหนัก
- cache Redis: session (TTL 60s) จึงไม่ยิง RDS ทุกคำขอ
- service cache รายละเอียด event เพื่อลด queries ซ้ำ ๆ
- Single RDS `db.t3.micro` ยังไหว เพราะลดการแตะ RDS ให้น้อยที่สุด

**Key number:** 226.4 req/s, ผ่านเกณฑ์ k6 99.89%

**Speaker notes:**
เสานี้แข็งเพราะมีตัวเลขจากการทดสอบจริง (docs/autoscaling-evidence.txt) เน้นว่าเรา breath-test ด้วย k6 กับ 200 VU แล้วระบบ scale-out เองด้วย HPA ไม่ต้องมีคนกดปุ่ม เชื่อมโยง: pod เริ่มที่ 2 แล้วเพิ่มเองเมื่อ CPU เกินขีดจากไฟล์ autoscaling-evidence.txt

**คำถามกรรมการที่ควรเตรียม:**
- p95 430 ms ดีไหม? - ตอบ: ไม่เร็วสุดแล้ว เพราะ DB ที่ t3.micro + cookie-introspection auth ไม่สามารถผ่านก่อน, เราเร่งไปได้ด้วย Redis session cache 60 วินาที
- สลับไปแยก cache table? - เปลือง RDS

**รูปภาพ - Visual Plan**
| ตำแหน่ง | ประเภท | เนื้อหา | แหล่ง | ขนาด | แคปชัน | สถานะ |
|---|---|---|---|---|---|---|
| กลางสไลด์ | กราฟเส้น/บาร์ | HPA 2->8 เมื่อ k6 ยิง | docs/autoscaling-evidence.txt (วาดใหม่ใน canva) | 45% | "จาก pod 2 ไป 8 อัตโนมัติ" | ต้องวาดใหม่ |
| ขวาบน | badge | 226 req / p95 430ms | canva text | เล็ก | - | วาดใน canva |
| ขวาล่าง | ไอคอน | gauge, bolt, db | canva | เล็ก | - | วาดใน canva |

---

## สไลด์ 8/14 - Reliability (เขียวสด #2E9E3E) (~1.4 นาที)

**Headline:** เสาที่ยังไม่แข็ง: ตรวจจับแต่ไม่มี DR

**Body:**
- pod ล้ม = k8s ดีดพื้นที่ health probe แล้วสร้างใหม่เอง
- health endpoint ไม่แตะ RDS/Redis ตามกฎของ repo (กัน blip กลายเป็น restart ทั้งระบบ)
- RDS: multi_az = false, backup_retention_period = 0 บนของเดิม
- Availability %, RTO, RPO: **[ไม่พบข้อมูล]** ไม่มีการวัดจริง
- ไม่มี Chaos Testing ใน repo เลย

**Key number:** backup = 0 วัน → RPO = 0 วัน

**Speaker notes:**
สไลด์ความซื่อสัตย์ — บอกตรง ๆ ว่า reliability คือเสาที่อ่อนที่สุด: k8s กัน pod ล้มได้ แต่ถ้า RDS ดับจริง ไม่มี replica, ไม่มี backup, ไม่มี DR plan เหตุผลบนประวัติ: งบ $50 ของ t3.micro ทำ multi-AZ ไม่ทัน และการถ่ายแผนคือเปิด multi-AZ + backup 1 วัน + ประเมินงบใหม่

**คำถามกรรมการที่ควรเตรียม:**
- RDS โดนแล้วระบบเป็นอย่างไร? - ตอบ: ทุก service error ทันที (health ไม่แตะ RDS เพื่อไม่ให้ pod restart ตามไปด้วย)
- ปรับแก้ที่ไหนก่อน? - ตอบ: เปิด backup_retention ก่อน (ถูกกว่า multi-AZ) แล้วจึง multi-AZ = true

**คำถามกรรมการที่ควรเตรียม:**
- ระบบดับแล้ว user เห็นอะไร? - k8s ตรวจ health ของ pod แล้ว ทดลองด้วย [ไม่พบข้อมูล - ไม่มี chaos test]
- แก้ยังไงเร็วสุด? - เปิด RDS multi-AZ และ backup = 1 วัน (ราคาแพงขึ้น)

**รูปภาพ - Visual Plan**
| ตำแหน่ง | ประเภท | เนื้อหา | แหล่ง | ขนาด | แคปชัน | สถานะ |
|---|---|---|---|---|---|---|
| ขวากลาง | ภาพหลัก | วาดง่าย ๆ: pod ตาย -> k8s เปิดใหม่เอง พร้อมไอคอนหัวใจ/สุขภาพ | canva | 45% | "k8s self-heal ระดับ pod" | ต้องวาดใหม่ |
| ขวาล่าง | ป้ายกำกับ | "RTO / RPO [ไม่วัด]" | canva | เล็ก | - | วาดใน canva |

---

## สไลด์ 9/14 - Sustainability (เขียวอมฟ้า #1FA88A) (~1.4 นาที)

**Headline:** ปลดจองทรัพยากรทิ้งเมื่อไม่ทำงาน

**Body:**
- `make down` ท้าย session: ลบ EKS + RDS + NLB ทั้งหมด - แทบ 0 ค่าใช้จ่ายรายวันจากแพลตฟอร์ม
- HPA ลด pod ลงเองเมื่อ traffic ผ่อน (2 -> 8 -> 2 วัดจริง)
- คลัสเตอร์เล็ก t3.micro/t3.medium เปลืองทรัพยากรหัวหน่วยต่ำกว่าที่จะ scale-up node
- เมชแนวคิด: platform = count = 0 คือ carbon ที่ดีที่สุดคือไม่มี compute ติด

**Key number:** platform=false = compute เหลือ 0 ทุกคืน

**Speaker notes:**
เล่าว่าระบบจ่ายค่า compute เมื่อเรียกใช้เพราะ deploy มี lifecycle สั้น เสานี้ความจริงบอกตรง ๆ ว่า sustainability ของ Eventide ทำได้ดีโดยบังเอิญของข้อจำกัดคือ ล้างทุกคืนด้วย make down จริง (terraform apply -var platform=false) ไม่ใช่เพราะมี metric carbon

**คำถามกรรมการที่ควรเตรียม:** แล้วถ้าต้องรัน production จริง?
- ตอบ: HPA ยังช่วย แต่ต้องมี right-sizing node group + spot capacity [ยังไม่ทำ]

**รูปภาพ - Visual Plan**
| ตำแหน่ง | ประเภท | เนื้อหา | แหล่ง | ขนาด | แคปชัน | สถานะ |
|---|---|---|---|---|---|---|
| ขวากลาง | ภาพหลัก | วาดง่าย ๆ: สายวงกลม "make up -> demo -> make down -> 0 compute" | canva | 45% | "ทุก resource กลับ scaffold เป็น 0 ทุกคืน" | ต้องวาดใหม่ |
| ขวาล่าง | ไอคอน | leaf, recycle | canva | เล็ก | - | วาดใน canva |

---

## สไลด์ 10/14 - Security (เทาเข้ม #3D4451) (~1.4 นาที)

**Headline:** ความปลอดภัย: แยกตามชั้นที่ทำได้จริง

**Body:**
- auth แยก service เดียวเก็บ secret (BETTER_AUTH_SECRET) + guard ทุก service
- ทุก service ส่ง introspection ตรวจ real-time + cache 60s ใน redis
- ข้อมูลเข้าระบบ S3 แบบ public เฉพาะ key ขึ้นต้น `public/*` เท่านั้น
- อื้อเป็น secret ปลอดภัย: credentials อยู่ Secrets Manager ไม่ลง pods
- จุดอ่อน: ยังไม่มี HTTPS (ไม่มีโดเมน) ทำให้ Google/Stripe หลุดไป

**Key number:** 4 k8s Secrets แบ่งตามสิทธิ์ + 3 secrets อยู่ Secrets Manager

**Speaker notes:**
เสานี้กรรมการชอบถามตรงเรื่อง user data "คุกกี้ session ถูกตรวจ live ทุกคำขอ ผ่าน auth-guard" และ file access ทุกไฟล์ไม่ใช่ public นอกจากอยู่ key `public/*` ย้ำว่า HTTPS ถูกออกแบบแล้ว (dns.tf ACM + cert วางไว้) แต่ยังไม่เข้า domain ระดับ lab จึงไม่เล่นทุกของใหญ่ (Google/Stripe)

**คำถามกรรมการที่ควรเตรียม:**
- HTTPS ไม่ส่งสำคัญไหม? - ใช่ และแก้ได้ด้วย dns.tf เมื่อมี domain จริง
- token อยู่ไหน? - ที่ lab session มี role IAM ร่วมจาก eventide-common

**รูปภาพ - Visual Plan**
| ตำแหน่ง | ประเภท | เนื้อหา | แหล่ง | ขนาด | แคปชัน | สถานะ |
|---|---|---|---|---|---|---|
| ขวากลาง | ภาพหลัก | ตัดของอย่างเป็นชั้น: web -> NLB -> ingress -> service -> (cookie guard) -> DB | canva วาดจาก architecture | 50% | "ประตู cookie เดียว ผ่านทางเดียว" | ต้องวาดใหม่ |
| ขวาล่าง | ไอคอน | lock, shield, key, s3 | canva | เล็ก | - | วาดใน canva |

---

## สไลด์ 11/14 - Cost Optimization (ม่วง #7B4FD0) (~1.4 นาที)

**Headline:** เสาที่แข็งที่สุด: ตัดของแต่ไม่ตัดหลัก

**Body:**
- งบ $50 เป็นข้อบังคับจึงตัดทุกอย่างที่ไม่ load-bearing จริง
- ใช้ make down ท้าย session เลิกจ่ายทันที รอมี session หน้าค่อยคืน
- RDS t3.micro เดียว + pod pool ต่ำ = ค่าจองเกมต่ำสุด
- ตัดทิ้งตั้งแต่ต้น: NAT, CloudFront, RDS ต่อ service, Prometheus
- ~$0.27/ชม (~$3.40/วัน) ตาแหล่งจากทีมคำนวณใน SYSTEM-DESIGN.md §11

**Key number:** $0.27/ชม · ~$1.10/session · $50 cap

**Speaker notes:**
เสาที่แข็งที่สุดเพราะถูกบังคับทุกครั้งที่ออกแบบ: ทุกค่าใช้จ่ายต้องมีเหตุผล ตัวเลข $0.27/ชม มาจากตารางต้นทุนใน SYSTEM-DESIGN.md; หลักการคือ platform=false คืนเงินทั้งก้อนทิ้ง session

**คำถามกรรมการที่ควรเตรียม:**
- ค่าถูกสุดอยู่ตรงไหน? - ตอบ: ไม่จ่ายตอนไม่ใช้ (make down), RDS เดียว shared, ไม่มี NAT/CloudFront
- ถ้าขยาย user จริงจะแพงแค่ไหน? - ตอบ: t3.micro อุดตันที่ connections ~87, ต้องขึ้น instance ก่อน

**รูปภาพ - Visual Plan**
| ตำแหน่ง | ประเภท | เนื้อหา | แหล่ง | ขนาด | แคปชัน | สถานะ |
|---|---|---|---|---|---|---|
| ขวากลาง | ภาพหลัก | การ์ดตัวเลข 3 ใบ: $0.27/hr, $1.10/session, $50 cap | canva วาด, ตัวเลขจาก SYSTEM-DESIGN.md #11 + terraform | 45% | "ทุก service จ่ายในระบบ" | ต้องวาดใหม่ |
| ขวาล่าง | ไอคอน | dollar, scissors, down-arrow | canva | เล็ก | - | วาดใน canva |

---

## สไลด์ 12/14 - Test Results (~1.5 นาที)

**Headline:** ทดสอบจริงบนเครื่องจริง k6 + HPA

**Body:**
- k6: 98,500 คำขอ / 200 VUs - ผ่าน 99.89%
- ความเร็ว 226.4 req/s avg 316.74 ms p95 430.56 ms
- HPA: ทำงานแบบอัตโนมัติ pod 2 -> 3 -> 5 -> 7 -> 8 กลับสู่ 2
- EKS GATE (2026-10-24): deploy ตั้งแต่ศูนย์ ผ่านครบทุกหมวด

**Key number:** 2 -> 8 pod กระทบ (226 req/s)

**Speaker notes:**
สไลด์พิสูจน์ว่า "auto-scale ไม่ใช่คำโปรย" - เชิงแสดงให้เห็นว่าตัวเลขมาจากโค้ดจริงใน docs/autoscaling-evidence.txt กรรมการมักถามต่อว่าหลักพิจารณาตัวเลข (HPA threshold)? - ตอบ: ตามข้อกำหนดค่า default CPU ใน values มี.patенциально

**คำถามกรรมการที่ควรเตรียม:**
- อะไรขลังเพิ่ม pods? - CPU average ตามหา (ดูไฟล์ values.yaml ข้อ hpa)
- ทดสอบกับ production จริงหรือ sandbox? - ทดสอบบนคลัสเตอร์ EKS จริงที่ deploy ขึ้น production shape เล็ก (ตาม autoscaling-evidence.txt)

**รูปภาพ - Visual Plan**
| ตำแหน่ง | ประเภท | เนื้อหา | แหล่ง | ขนาด | แคปชัน | สถานะ |
|---|---|---|---|---|---|---|
| กลางซ้าย | กราฟหลัก | ลำดับ pod: 2-3-5-7-8 แล้วกลับ 8-6-4-2 นับ per minute | วาดใหม่ใน canva จาก docs/autoscaling-evidence.txt | 50% | "HPA ตอบสนองจริงทั้งไปและกลับ" | ต้องวาดใหม่ |
| ขวาบน | badge 3 ใบ | 226.4 req/s, 99.89%, p95 430ms | canva text | เล็ก | - | วาดใน canva |
| ขวาล่าง | screenshot เล็ก | log kubectl จำนวน pod เปลี่ยน | ถ่ายจาก session จริง | เล็ก | - | ต้องแคปเพิ่ม |

---

## สไลด์ 13/14 - ข้อจำกัดและทางต่อไป (~1.5 นาที)

**Headline:** ตัดอะไรไป เพราะอะไร และเติมคืนได้เมื่อไร

**Body:**
- ไม่มี HTTPS: ไม่มีโดเมน - Stripe webhook + Google sign-in จึงปิด
- ไม่มี Chaos Testing, ไม่ได้วัด RTO/RPO [ยังไม่ทำ]
- CloudWatch Container Insights [ไม่พบข้อมูล - สถานะยังไม่ได้ตรวจ]
- จุดที่ต่อยอดได้: เปิด dns.tf เมื่อมีโดเมน = HTTPS + Route53 ทำงาน

**Key number:** ปิด HTTPS แต่เตรียม IaC รับไว้แล้ว

**Speaker notes:**
อุปสรรคที่เจอต้องเรียงตามเหตุผลที่ชัดเจน เสนอว่า "ตัดไว้ตามเหตุผลธุรกิจ (AWS SCP, IAM deny) ตัด far-Fetch และแสดงว่าเรารู้ทางแก้เปิด, ไม่ได้ทำเพราะไม่รู้" ย้ำว่า dns.tf ออกแบบ wildcard ACM + Route53 ไว้รออยู่แล้ว

**คำถามกรรมการที่ควรเตรียม:**
- ย้ายได้ไหมถ้ามี domain จริง? - ตอบ: เปิด dns.tf (Route53 + ACM) ทำงานเลย
- ถ้า no domain จะทำ Stripe ได้ไหม?? - ใช้ stripe listen --forward-to จากเครื่องสาธิต (docs/TODO.md)

**รูปภาพ - Visual Plan**
| ตำแหน่ง | ประเภท | เนื้อหา | แหล่ง | ขนาด | แคปชัน | สถานะ |
|---|---|---|---|---|---|---|
| ขวากลาง | ภาพหลัก | ตาราง 2 คอลัมน์: ทำแล้ว (เขียว) vs ยังไม่ทำ (ส้ม) แต่ละอันมีป้ายเหตุผลสั้น | จาก docs/REPORT.md #2 + dns.tf | 50% | "ทุกข้อยังไม่ทำต้องมีเหตุผล" | วาดใน canva |
| ขวาล่าง | ไอคอน | flag, road, traffic-cone | canva | เล็ก | - | วาดใน canva |

---

## สไลด์ 14/14 - สรุป (~1 นาที)

**Headline:** เว็บขายตั๋วจริงบน EKS ในงบ $50

**Body:**
- ออกแบบจากข้อจำกัดจริง ไม่ใช่คำตอบจาก textbook
- ทุกตัวเลขพูดมามีหลักฐานไฟล์ใน repo
- เสาที่แข็ง: Cost, OpEx - เสาที่อ่อน: Reliability
- พร้อมต่อยอด: dns.tf, HPA, multi-AZ เมื่องบอนุญาต

**Key number:** 14 สไลด์ = 1 ระบบ = 6 เสาจริง

**Speaker notes:**
ปิดด้วยข้อความเดียว: "เราปล่อยระบบจริงที่ลูกค้าใช้ซื้อตั๋วจริงได้ ไม่ใช่ demo กระดาษ" ถ้ากรรมการชวน chat ให้กลับไปที่ไดอะแกรม as-built ทุกคำตอบอ้างไฟล์

**รูปภาพ - Visual Plan**
| ตำแหน่ง | ประเภท | เนื้อหา | แหล่ง | ขนาด | แคปชัน | สถานะ |
|---|---|---|---|---|---|---|
| ขวากลาง | ภาพหลัก | ไดอะแกรม as-built ย่อขนาด + 6 ไอคอนเสาด้วยสี 6 สี | eventide-aws-as-built.png + canva (แสดง skyline ของ 6 สี) | 55% | "ระบบเดียว ตรวจได้ทุกเสา" | พร้อมใช้ |
| ขวาล่าง | ไอคอน | Q&A icon | canva | เล็ก | - | วาดใน canva |

---

## หมายเหตุโครงเรื่อง (เช็คว่าครบ)
ทั้ง 14 สไลด์ครบ สไลด์ 1, 4, 5 (แผนที่) และ 14 (สรุป) เป็นสไลด์โครงเรื่อง ที่ 6-11 คือเสา เรียงตามสี 6 สี
