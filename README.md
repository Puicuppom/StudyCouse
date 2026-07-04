# Study Todo — รายการเรียน

เว็บ to-do list สำหรับเรียน เก็บข้อมูลใน Supabase

## ฟีเจอร์

- สร้างหมวดหมู่เรียน
- ใส่ลิงก์เนื้อหา (คลิกเปิดได้)
- ติ๊กว่าเรียนแล้ว พร้อม progress bar

## เริ่มใช้งาน

### 1. ตั้งค่าฐานข้อมูล Supabase

เปิด [SQL Editor](https://supabase.com/dashboard/project/rwsyiiulfbolymxppvmy/sql/new) แล้วรันไฟล์ `supabase/schema.sql`

### 2. รันแอป

```bash
npm install
npm run dev
```

เปิด http://localhost:5173

## Environment

คัดลอกจาก `.env.example` เป็น `.env` แล้วใส่ค่า Supabase URL และ Anon Key
