package com.iodev.practicum.controller;

import com.iodev.practicum.model.College;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.Department;
import com.iodev.practicum.model.MonthlyWeeklyReport;
import com.iodev.practicum.model.Program;
import com.iodev.practicum.model.Semester;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.model.WeeklyReportDraft;
import com.iodev.practicum.repository.StudentManagementRepository;
import com.iodev.practicum.repository.StudentWeeklyQueries;
import com.iodev.practicum.repository.WeeklyReportDraftRepository;
import com.iodev.practicum.service.StudentWorkService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Comparator;

/**
 * Ang editor ng weekly report ng student: ang header (galing sa system) at ang draft na
 * isine-save sa server para makuha rin sa ibang device. Ang unang kopya ay nasa device mismo.
 */
@RestController
@RequestMapping("/api/student/weekly-draft/{refId}")
public class StudentWeeklyDraftController {

    private static final int MAX_CHARS = 200_000;

    public record Header(String studentName, String course, String company, String department, String semester,
                         String collegeAbbreviation, String weekFrom, String weekTo,
                         String supervisorName, String supervisorPosition, String collegeLogoPath) {}

    public record DraftData(String content, Long clientUpdatedAt) {}

    public record Detail(Header header, DraftData draft) {}

    public record SaveRequest(String content, Long clientUpdatedAt) {}

    public record SaveResult(boolean saved, DraftData draft) {}

    @Autowired private StudentManagementRepository studentManagementRepository;
    @Autowired private StudentWorkService work;
    @Autowired private StudentWeeklyQueries weeklyQueries;
    @Autowired private WeeklyReportDraftRepository drafts;

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> detail(@PathVariable Long refId, Authentication auth) {
        Student s = current(auth);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");
        MonthlyWeeklyReport week = weekOf(s, refId);
        if (week == null) return ResponseEntity.status(404).body("Not found.");

        WeeklyReportDraft d = drafts.findByStudentIdAndMonthlyWeeklyReportId(s.getId(), refId).orElse(null);
        return ResponseEntity.ok(new Detail(header(s, week),
                d == null ? null : new DraftData(d.getContent(), d.getClientUpdatedAt())));
    }

    @PutMapping
    @Transactional
    public ResponseEntity<?> save(@PathVariable Long refId, @RequestBody SaveRequest body, Authentication auth) {
        Student s = current(auth);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");
        if (weekOf(s, refId) == null) return ResponseEntity.status(404).body("Not found.");
        if (body == null || body.content() == null) return ResponseEntity.badRequest().body("Nothing to save.");
        if (body.content().length() > MAX_CHARS) return ResponseEntity.badRequest().body("The report is too long.");

        long incoming = body.clientUpdatedAt() == null ? System.currentTimeMillis() : body.clientUpdatedAt();
        WeeklyReportDraft d = drafts.findByStudentIdAndMonthlyWeeklyReportId(s.getId(), refId).orElse(null);
        if (d != null && d.getClientUpdatedAt() != null && d.getClientUpdatedAt() > incoming) {
            // Mas bago ang nasa server (galing sa ibang device): ibalik ito, huwag patungan
            return ResponseEntity.ok(new SaveResult(false, new DraftData(d.getContent(), d.getClientUpdatedAt())));
        }
        if (d == null) {
            d = new WeeklyReportDraft();
            d.setStudentId(s.getId());
            d.setMonthlyWeeklyReportId(refId);
        }
        d.setContent(body.content());
        d.setClientUpdatedAt(incoming);
        drafts.save(d);
        return ResponseEntity.ok(new SaveResult(true, new DraftData(d.getContent(), d.getClientUpdatedAt())));
    }

    // ---------------------------------------------------------------------

    private MonthlyWeeklyReport weekOf(Student s, Long refId) {
        if (work.find(s, StudentWorkService.WEEKLY, refId) == null) return null;
        for (MonthlyWeeklyReport w : weeklyQueries.weeksFor(s.getCoordinator().getId(), s.getSemester().getId())) {
            if (w.getId().equals(refId)) return w;
        }
        return null;
    }

    private Header header(Student s, MonthlyWeeklyReport week) {
        Coordinator coordinator = s.getCoordinator();
        Program program = coordinator == null ? null : coordinator.getProgram();
        College college = program == null ? null : program.getCollege();
        Department dept = s.getDepartment();

        String course = program == null ? "" : nz(program.getAbbreviation());
        if (course.isEmpty() && program != null) course = nz(program.getName());

        return new Header(
                ((nz(s.getFirstname()) + " " + nz(s.getLastname())).trim()),
                course,
                dept == null || dept.getCompany() == null ? "" : nz(dept.getCompany().getName()),
                dept == null || "N/A".equalsIgnoreCase(nz(dept.getName())) ? "" : nz(dept.getName()),
                semesterLabel(s.getSemester()),
                college == null ? "" : nz(college.getAbbreviation()),
                week.getMonthFrom() == null ? "" : week.getMonthFrom().toString(),
                week.getMonthTo() == null ? "" : week.getMonthTo().toString(),
                dept == null ? "" : nz(dept.getSupervisorFullname()),
                dept == null ? "" : nz(dept.getSupervisorPosition()),
                college == null || college.getLogo() == null || college.getLogo().isBlank() ? ""
                        : "/public/colleges/" + college.getId() + "/logo?v="
                        + (college.getUpdatedAt() == null ? 0 : college.getUpdatedAt().getTime()));
    }

    private static String nz(String v) {
        return v == null ? "" : v.trim();
    }

    private static String semesterLabel(Semester semester) {
        if (semester == null) return "";
        String term = reflect(semester, "getSemester", "getName", "getTerm");
        String year = reflect(semester, "getSchoolYear", "getAcademicYear", "getYear");
        if (term.isEmpty()) return year;
        return year.isEmpty() ? term : term + ", " + year;
    }

    private static String reflect(Object target, String... getters) {
        for (String g : getters) {
            try {
                Object v = target.getClass().getMethod(g).invoke(target);
                if (v != null && !v.toString().isBlank()) return v.toString().trim();
            } catch (ReflectiveOperationException ignored) {
                // susunod na pangalan
            }
        }
        return "";
    }

    private Student current(Authentication authentication) {
        if (authentication == null) return null;
        return studentManagementRepository.findByEmail(authentication.getName()).stream()
                .max(Comparator.comparing(Student::getId))
                .orElse(null);
    }
}
