# Rancangan Data Konseptual

Entitas yang disarankan: - EducationUnit: unit MTs/MA. - AcademicYear,
Semester. - UserProfile: akun, role, lingkup unit, status. - Student,
Teacher. - ClassGroup, ClassEnrollment. - Subject, ClassSubject,
Curriculum, Schedule. - AttendanceRecord. - AssessmentComponent,
StudentScore. - ReportCard, PromotionDecision. - LMSCourse,
LearningMaterial, Assignment, AssignmentSubmission. - QuestionBankItem,
Exam, ExamQuestion, ExamAttempt, ExamAnswer. - AuditLog.

## Relasi

-   Unit memiliki siswa, guru, dan kelas.
-   Pendaftaran kelas menghubungkan siswa, kelas, dan tahun ajaran.
-   Penugasan mapel menghubungkan kelas, mapel, guru, dan periode.
-   Nilai mengacu pada siswa dan komponen penilaian.
-   Rapor mengacu pada siswa, kelas, semester, dan nilai.
-   Materi/tugas LMS terkait course, kelas, mapel, guru, dan periode.
-   Pengumpulan tugas menghubungkan tugas dan siswa.
-   Ujian menghubungkan peserta, bank soal, jadwal, dan mata pelajaran.
-   Pengerjaan ujian dan jawaban terkait siswa, ujian, dan soal.

## Validasi

Gunakan ID unik, validasi unit/kelas, cegah duplikasi tidak semestinya,
validasi rentang nilai dan bobot, lindungi kunci jawaban, simpan waktu
perubahan bila didukung, serta arsipkan data penting alih-alih menghapus
permanen tanpa alasan. Sesuaikan entitas dengan kemampuan platform tanpa
menggandakan struktur yang sudah tersedia.
