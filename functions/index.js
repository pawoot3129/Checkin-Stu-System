// functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");

// เริ่มต้นการเชื่อมต่อในฐานะแอดมิน
admin.initializeApp();

// สร้าง Cloud Function ที่ชื่อว่า createTeacherUser
exports.createTeacherUser = functions.https.onCall(async (data, context) => {
  // --- 1. ตรวจสอบสิทธิ์ ---
  // เช็คว่าคนที่เรียกใช้ฟังก์ชันนี้ล็อกอินอยู่หรือไม่
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "คุณต้องล็อกอินก่อนจึงจะดำเนินการได้"
    );
  }

  // เช็คว่าคนที่เรียกใช้เป็นแอดมินจริงหรือไม่
  const callerDoc = await admin
      .firestore()
      .collection("users")
      .doc(context.auth.uid)
      .get();
  
  if (callerDoc.data().role !== "admin") {
    throw new functions.https.HttpsError(
        "permission-denied",
        "เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถสร้างบัญชีครูได้"
    );
  }

  // --- 2. รับข้อมูลที่ส่งมา ---
  const { email, password, name, username, assignedClasses } = data;
  if (!email || !password || !name || !username) {
     throw new functions.https.HttpsError(
        "invalid-argument",
        "กรุณาส่งข้อมูลให้ครบถ้วน (email, password, name, username)"
    );
  }

  try {
    // --- 3. สร้างผู้ใช้ใน Authentication ---
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: name,
    });

    console.log("Successfully created new user:", userRecord.uid);

    // --- 4. สร้างโปรไฟล์ใน Firestore ---
    // เราจะใช้ uid ที่ได้จาก Authentication มาเป็น ID ของเอกสารเลย
    await admin.firestore().collection("users").doc(userRecord.uid).set({
      name: name,
      username: username,
      email: email,
      role: "teacher",
      assignedClasses: assignedClasses || [], // ถ้าไม่มีการส่งมา ให้เป็น array ว่าง
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // --- 5. ส่งผลลัพธ์กลับไป ---
    return { status: "success", message: `สร้างบัญชีครู ${name} สำเร็จ!` };
  } catch (error) {
    console.error("Error creating new user:", error);
    // แปลง Error code ของ Firebase ให้เข้าใจง่ายขึ้น
    if (error.code === 'auth/email-already-exists') {
        throw new functions.https.HttpsError('already-exists', 'อีเมลนี้มีผู้ใช้งานในระบบแล้ว');
    }
    throw new functions.https.HttpsError("internal", "เกิดข้อผิดพลาดในการสร้างบัญชีผู้ใช้");
  }
});