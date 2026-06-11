// محاكاة دوال الفايربيز لتشغيل منصة EduTok بنجاح دون توقف الموقع

// 1. جلب وحفظ الفيديوهات التعليمية
export function subscribeToVideos(callback) {
  const localData = localStorage.getItem("edutok_videos");
  const initialVideos = localData ? JSON.parse(localData) : [
    {
      title: "مقدمة في الكيمياء الحرارية - انثالبي التفاعل",
      url: "https://www.w3schools.com/html/mov_bbb.mp4",
      section: "الفصل الأول: الكيمياء الحرارية",
      isLocked: false
    }
  ];
  callback(initialVideos);
  return () => {}; // Unsubscribe mock
}

export async function saveVideoToDB(videoData) {
  const localData = localStorage.getItem("edutok_videos");
  const currentVideos = localData ? JSON.parse(localData) : [];
  const updatedVideos = [...currentVideos, videoData];
  localStorage.setItem("edutok_videos", JSON.stringify(updatedVideos));
  return true;
}

// 2. جلب وحفظ بيانات الطلاب واشتراكاتهم
export function subscribeToStudents(callback) {
  const localData = localStorage.getItem("edutok_students");
  const currentStudents = localData ? JSON.parse(localData) : [];
  callback(currentStudents);
  return () => {}; // Unsubscribe mock
}

export async function saveStudentToDB(studentData) {
  const localData = localStorage.getItem("edutok_students");
  const currentStudents = localData ? JSON.parse(localData) : [];
  const updatedStudents = [...currentStudents, studentData];
  localStorage.setItem("edutok_students", JSON.stringify(updatedStudents));
  return true;
}
