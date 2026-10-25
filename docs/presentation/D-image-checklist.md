# D-image-checklist.md - รวมภาพที่ต้องหาทั้งหมด (เรียงตามสไลด์)

## กลุ่ม 1: ต้องแคปเพิ่ม / ต้องวาดใหม่ (ทำก่อน)

| # | สไลด์ที่ | ชื่อภาพ | แหล่งที่มา | สถานะ | งานที่ต้องทำ |
|---|---|---|---|---|---|
| 1 | 1 | หน้าเว็บจริง (หน้า home) | `docs/screenshots/01-home.png` | พร้อมใช้ | crop ขอบจอออกให้สะอาดก่อนใส่ปก |
| 2 | 1 | โลโก้ Eventide | วาดใน Canva | ต้องทำ | วาดโลโก้เล็ก ๆ มุมซ้ายบน |
| 3 | 2 | screenshot รายการตั๋ว 3 ชนิด | `docs/screenshots/03-event-detail.png` | พร้อมใช้ | crop เอาเฉพาะ box แสดงประเภทตั๋ว |
| 4 | 3 | หน้า Learner Lab | ถ่ายเอง / Canva | ต้องแคปเพิ่ม | ถ่ายหน้า AWS console แสดงสถานะ $50 |
| 5 | 4 | ไดอะแกรม as-built เต็มภาพ | `docs/architecture/aws/eventide-aws-as-built.png` | พร้อมใช้ | ใช้ตรง ๆ ไม่ต้องแก้ |
| 6 | 6 | Terminal `make deploy` สำเร็จ | session log / terminal | ต้องแคปเพิ่ม | แคป 1 จอที่เห็น 7 images push สำเร็จ |
| 7 | 7 | กราฟ HPA 2 -> 8 | ข้อมูลจาก `docs/autoscaling-evidence.txt` | ต้องวาดใหม่ | ใช้ Canva หรือ Charts ตามขั้น 2-3-5-7-8-6-4-2 |
| 8 | 8 | pod ตาย -> k8s เปิดใหม่ | Canva | ต้องวาดใหม่ | วาดง่าย ๆ แบบ icon (ไม่ใช่ diagram in-depth) |
| 9 | 9 | วงจร make up / make down | Canva | ต้องวาดใหม่ | สร้างเป็นวงกลม 5 ขั้นพร้อมไอคอน |
| 10 | 10 | แผนภาพชั้น web -> NLB -> ingress -> service -> DB | Canva วาดใหม่ | ต้องวาดใหม่ | ไฮไลต์เส้น cookie ที่ auth-guard |
| 11 | 11 | การ์ดตัวเลข ต้นทุน 3 ใบ ($0.27/hr, $1.10/session, $50 cap) | Canva + `docs/SYSTEM-DESIGN.md` §11 | ต้องวาดใหม่ | ระวังตัวเลขให้ตรง (คัดลอกจาก .md โดยตรง) |
| 12 | 12 | กราฟ k6 ผลลัพธ์ | วาดจาก `docs/autoscaling-evidence.txt` | ต้องวาดใหม่ | สร้าง bar chart: p95, req/s, ผ่าน % |
| 13 | 12 | kubectl pod count log | session log | ต้องแคปเพิ่ม | แคปจอที่เห็นจำนวน pod เปลี่ยนจาก 2 เป็น 8 |
| 14 | 13 | ตาราง ทำแล้ว / ยังไม่ทำ | Canva วาดจาก `docs/REPORT.md` §2 | ต้องวาดใหม่ | เขียน checkmark/cross แต่ละแถวระบุในสถานะ |
| 15 | 14 | โครง as-built ย่อ + 6 ไอคอนเสา | `eventide-aws-as-built.png` + Canva | พร้อมใช้ | วางให้ย่อแล้วติด 6 ไอคอนสี 6 สีด้านขวา |
| 16 | 5 | ภาพ temple เสา 6 ต้น 6 สี (แผนที่) | Canva | ต้องวาดใหม่ | เป็น temple diagram เสา 6 ต้น ใช้สี 6 สีจากกฎการออกแบบ |

## กลุ่ม 2: Screenshot สถานะดี (จะดึงมาใช้หากสไลด์ใดว่าง)

| สไลด์ที่ | ชื่อภาพ | แหล่งที่มา | สถานะ |
|---|---|---|---|
| 2 | event detail user | `docs/screenshots/03-event-detail.png` | พร้อมใช้ |
| 2 | admin check-in | `docs/screenshots/19-admin-checkin.png` | พร้อมใช้ |
| 2 | organizer sale dashboard | `docs/screenshots/13-org-sales.png` | พร้อมใช้ |
| 4 | ไดอะแกรม target (เทียบ) | `docs/architecture/aws/AWS_Diagram_Tool.jpg` | พร้อมใช้ |
| 12 | pod autoscaling ไหลไป | session logs (kubectl get pods -w) | ต้องแคปเพิ่ม |

## ข้อควรจำในการแทรกภาพ

1. อย่าลืมใส่ ALT text (Canva Alt Text) ระบุเสาที่เกี่ยว และบอกเสาว่า "อ้างอิงจาก docs/...path"
2. ภาพมาจาก session จริงต้องไร้สะพาน credentials / keys ให้ตัดเมกอใด mismatch
3. ต้องรู้เส้นทางความสัมพันธ์ - หากภาพมี URL แสดง NLB DNS name ให้ปิดด้วยกล่องสีเทาปิด หรือ crop ออกก่อนใส่ใน Canva
4. แคปชันหลักของทุกภาพ: เขียนสั้น ไม่เกิน 10 คำ และไม่ซ้ำกับ bullet

---

## คำถามค้าง (ต้องกลับมาตัดสินใจจาก user)

1. **ตัวเลข k6 & HPA คือ topology/ไหน?** - ตัวเลขพวกนี้วัดจากสถาปัตยกรรม/แผนที่/เซนต์วันเดียวกันของ session 2026-10-24 หรือไม่ ต้องยืนยันก่อนพูดบนเวที
2. **CloudWatch Container Insights เปิดหรือไม่?** ณ 2026-10-24 ยังไม่ได้ยืนยัน (ยังไม่มีหลักฐานใน repo ว่าเปิดหรือปิด)
3. **Chaos Testing ต้องการทำ?** ทำก่อนวันสอบหรือหลังสอบ? ใช้เครื่องมืออะไร (litmus / chaos-mesh)?
4. **จำนวนสไลด์ 14 พอใจหรือไม่?** ถ้าไม่ - ระบุจำนวนใหม่เพื่อปรับสไลด์เสา
5. **RTO/RPO จะวัดจริง?** ถ้าไม่วัด ระบุว่า "นำสเตตัสเป็น [ไม่พบข้อมูล]" ได้เลย ?ถ้าจะวัด เทปเลย์บุ๊กควรเตรียมอย่างไร?
