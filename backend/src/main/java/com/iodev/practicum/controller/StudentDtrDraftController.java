package com.iodev.practicum.controller;

import com.iodev.practicum.service.SupervisorResolver;
import com.iodev.practicum.model.College;
import com.iodev.practicum.model.Company;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.Department;
import com.iodev.practicum.model.DtrDraft;
import com.iodev.practicum.model.MonthlyDtr;
import com.iodev.practicum.model.Program;
import com.iodev.practicum.model.Semester;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.DtrDraftRepository;
import com.iodev.practicum.repository.StudentManagementRepository;
import com.iodev.practicum.repository.StudentWorkQueries;
import com.iodev.practicum.service.StudentWorkService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.Month;
import java.time.YearMonth;
import java.time.format.TextStyle;
import java.util.Comparator;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Ang DTR maker ng student: ang header (galing sa system) at ang draft na isine-save sa server
 * para makuha rin sa ibang device. Ang unang kopya ay nasa device mismo.
 */
@RestController
@RequestMapping("/api/student/dtr-draft/{refId}")
public class StudentDtrDraftController {

    private static final int MAX_CHARS = 200_000;
    private static final Pattern YEAR = Pattern.compile("(20\\d{2})");

    public record Header(String studentName, String course, String year, String company, String department,
                         String semester, String collegeAbbreviation, String collegeLogoPath,
                         String monthLabel, String monthStart, String monthEnd,
                         String supervisorName, String supervisorPosition) {}

    public record DraftData(String content, Long clientUpdatedAt) {}

    public record Detail(Header header, DraftData draft) {}

    public record SaveRequest(String content, Long clientUpdatedAt) {}

    public record SaveResult(boolean saved, DraftData draft) {}

    @Autowired private StudentManagementRepository studentManagementRepository;
    @Autowired private StudentWorkService work;
    @Autowired private StudentWorkQueries dtrQueries;
    @Autowired private DtrDraftRepository drafts;

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> detail(@PathVariable Long refId, Authentication auth) {
        Student s = current(auth);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");
        MonthlyDtr dtr = dtrOf(s, refId);
        if (dtr == null) return ResponseEntity.status(404).body("Not found.");

        DtrDraft d = drafts.findByStudentIdAndMonthlyDtrId(s.getId(), refId).orElse(null);
        return ResponseEntity.ok(new Detail(header(s, dtr),
                d == null ? null : new DraftData(d.getContent(), d.getClientUpdatedAt())));
    }

    @PutMapping
    @Transactional
    public ResponseEntity<?> save(@PathVariable Long refId, @RequestBody SaveRequest body, Authentication auth) {
        Student s = current(auth);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");
        if (dtrOf(s, refId) == null) return ResponseEntity.status(404).body("Not found.");
        if (body == null || body.content() == null) return ResponseEntity.badRequest().body("Nothing to save.");
        if (body.content().length() > MAX_CHARS) return ResponseEntity.badRequest().body("The DTR is too long.");

        long incoming = body.clientUpdatedAt() == null ? System.currentTimeMillis() : body.clientUpdatedAt();
        DtrDraft d = drafts.findByStudentIdAndMonthlyDtrId(s.getId(), refId).orElse(null);
        if (d != null && d.getClientUpdatedAt() != null && d.getClientUpdatedAt() > incoming) {
            // Mas bago ang nasa server (galing sa ibang device): ibalik ito, huwag patungan
            return ResponseEntity.ok(new SaveResult(false, new DraftData(d.getContent(), d.getClientUpdatedAt())));
        }
        if (d == null) {
            d = new DtrDraft();
            d.setStudentId(s.getId());
            d.setMonthlyDtrId(refId);
        }
        d.setContent(body.content());
        d.setClientUpdatedAt(incoming);
        drafts.save(d);
        return ResponseEntity.ok(new SaveResult(true, new DraftData(d.getContent(), d.getClientUpdatedAt())));
    }

    // ---------------------------------------------------------------------

    private MonthlyDtr dtrOf(Student s, Long refId) {
        if (work.find(s, StudentWorkService.DTR, refId) == null) return null;
        for (MonthlyDtr d : dtrQueries.dtrsFor(s.getCoordinator().getId(), s.getSemester().getId())) {
            if (d.getId().equals(refId)) return d;
        }
        return null;
    }

    private Header header(Student s, MonthlyDtr dtr) {
        Coordinator coordinator = s.getCoordinator();
        Program program = coordinator == null ? null : coordinator.getProgram();
        College college = program == null ? null : program.getCollege();
        Department dept = s.getDepartment();
        Company company = dept == null ? null : dept.getCompany();

        String course = program == null ? "" : nz(program.getAbbreviation());
        if (course.isEmpty() && program != null) course = nz(program.getName());

        String companyLine = "";
        if (company != null) {
            companyLine = nz(company.getName());
            String address = nz(company.getAddress());
            String location = nz(company.getLocation());
            if (!address.isEmpty()) companyLine += (companyLine.isEmpty() ? "" : " ") + address;
            if (!location.isEmpty()) companyLine += (companyLine.isEmpty() ? "" : ", ") + location;
        }

        YearMonth ym = resolveMonth(dtr.getMonth(), dtr.getDueDate());

        return new Header(
                (nz(s.getFirstname()) + " " + nz(s.getLastname())).trim(),
                course,
                nz(s.getYear()),
                companyLine,
                dept == null ? "" : SupervisorResolver.departmentLabel(dept.getName()),
                semesterLabel(s.getSemester()),
                college == null ? "" : nz(college.getAbbreviation()),
                college == null || college.getLogo() == null || college.getLogo().isBlank() ? ""
                        : "/public/colleges/" + college.getId() + "/logo?v="
                        + (college.getUpdatedAt() == null ? 0 : college.getUpdatedAt().getTime()),
                nz(dtr.getMonth()),
                ym == null ? "" : ym.atDay(1).toString(),
                ym == null ? "" : ym.atEndOfMonth().toString(),
                SupervisorResolver.forDepartment(dept).name(),
                SupervisorResolver.forDepartment(dept).position());
    }

    /**
     * Ang buwan ay isang teksto lang ("March" o "March 2024"). Kung walang taon, hinuhulaan ito mula sa
     * due date: ang pinakabagong buwang iyon na hindi lumalampas sa due date (hal. Disyembre na due ng Enero).
     */
    private static YearMonth resolveMonth(String raw, Timestamp due) {
        if (raw == null || raw.isBlank()) return null;
        String s = raw.toLowerCase(Locale.ENGLISH);
        int month = 0;
        for (Month m : Month.values()) {
            if (s.contains(m.getDisplayName(TextStyle.FULL, Locale.ENGLISH).toLowerCase(Locale.ENGLISH))) {
                month = m.getValue();
                break;
            }
        }
        if (month == 0) {
            for (Month m : Month.values()) {
                String abbr = m.getDisplayName(TextStyle.SHORT, Locale.ENGLISH).toLowerCase(Locale.ENGLISH);
                if (Pattern.compile("\\b" + abbr + "\\b").matcher(s).find()) {
                    month = m.getValue();
                    break;
                }
            }
        }
        if (month == 0) return null;

        Matcher y = YEAR.matcher(s);
        if (y.find()) return YearMonth.of(Integer.parseInt(y.group(1)), month);

        LocalDate ref = due != null ? due.toLocalDateTime().toLocalDate() : LocalDate.now();
        int year = ref.getYear();
        if (month > ref.getMonthValue()) year -= 1;
        return YearMonth.of(year, month);
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
