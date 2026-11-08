package com.iodev.practicum.controller;

import com.iodev.practicum.dto.DashboardDtos.*;
import com.iodev.practicum.model.Company;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.Department;
import com.iodev.practicum.model.DocumentRequirement;
import com.iodev.practicum.model.MonthlyDtr;
import com.iodev.practicum.model.Semester;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.CompanyRepository;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.DepartmentRepository;
import com.iodev.practicum.repository.DocumentRequirementAttachmentRepository;
import com.iodev.practicum.repository.DtrDraftRepository;
import com.iodev.practicum.repository.SemesterRepository;
import com.iodev.practicum.repository.SignedDtrRepository;
import com.iodev.practicum.repository.StudentRepository;
import com.iodev.practicum.repository.SubmissionFileRepository;
import com.iodev.practicum.repository.WeeklyReportDraftRepository;
import com.iodev.practicum.service.StudentProgressService;
import com.iodev.practicum.service.StudentProgressService.Category;
import com.iodev.practicum.service.StudentProgressService.Snapshot;
import com.iodev.practicum.service.StudentWorkService;
import com.iodev.practicum.util.EvaluationAccess;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Dashboard ng coordinator: lahat ng buod para sa napiling semester sa isang request.
 * Laging naka-scope sa coordinator na naka-login (galing sa token, hindi sa request) at sa semester.
 * Ang progress ay galing sa StudentProgressService, kaya pareho ito ng Progress page ng student.
 */
@RestController
@RequestMapping("/api/coordinator/dashboard")
public class CoordinatorDashboardController {

    /** Mas mababa rito = kailangang tutukan (kung nakapagsimula na ang student) */
    static final int LOW_PROGRESS = 40;
    /** Ito pataas = malapit nang matapos */
    static final int HIGH_PROGRESS = 80;
    /** Ilang araw na walang activity bago ituring na inactive */
    static final int INACTIVE_DAYS = 7;
    /** Pinakamaraming pangalan sa listahan ng walang training duration */
    static final int LIST_LIMIT = 10;

    private static final List<String> STATUS_ORDER = List.of("For Approval", "Approved", "Deployed", "Completed");

    @Autowired private CoordinatorRepository coordinatorRepository;
    @Autowired private SemesterRepository semesterRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private DocumentRequirementAttachmentRepository attachmentRepository;
    @Autowired private SignedDtrRepository signedDtrRepository;
    @Autowired private SubmissionFileRepository submissionFileRepository;
    @Autowired private DtrDraftRepository dtrDraftRepository;
    @Autowired private WeeklyReportDraftRepository weeklyDraftRepository;
    @Autowired private StudentProgressService progress;

    /** Status at huling pagbabago ng isang (student, requirement/buwan) */
    private record Cell(String status, Timestamp updatedAt) {}

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> dashboard(@RequestParam Long semesterId, Authentication authentication) {
        Coordinator coordinator = coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
        if (coordinator == null) return ResponseEntity.status(403).body("Coordinator profile not found.");
        Semester semester = semesterRepository.findById(semesterId).orElse(null);
        if (semester == null) return ResponseEntity.status(404).body("Semester not found.");

        Long cid = coordinator.getId();
        List<Student> students = studentRepository.findForTracking(cid, semesterId);
        List<Long> studentIds = students.stream().map(Student::getId).toList();

        // Mga company at department ng coordinator na ito sa semester na ito lang
        List<Company> companies = companyRepository.findForAssignment(cid, semesterId);
        List<Department> departments = companies.isEmpty() ? List.of()
                : departmentRepository.findActiveByCompanyIds(companies.stream().map(Company::getId).toList())
                        .stream().filter(d -> d.getStatus() == null || "approved".equalsIgnoreCase(d.getStatus().trim()))
                        .toList();

        Snapshot snap = progress.load(cid, semesterId, students);

        // Pinakahuling upload bawat (student, scope, ref) at bawat student
        Map<String, Timestamp> slotUpload = new HashMap<>();
        Map<Long, Timestamp> lastActivity = new HashMap<>();
        if (!studentIds.isEmpty()) {
            for (Object[] row : submissionFileRepository.lastUploads(studentIds)) {
                Long sid = id(row[0]);
                Timestamp at = (Timestamp) row[3];
                slotUpload.put(sid + "-" + row[1] + "-" + id(row[2]), at);
                lastActivity.merge(sid, at, CoordinatorDashboardController::later);
            }
            for (Object[] row : dtrDraftRepository.lastSaved(studentIds)) {
                lastActivity.merge(id(row[0]), (Timestamp) row[1], CoordinatorDashboardController::later);
            }
            for (Object[] row : weeklyDraftRepository.lastSaved(studentIds)) {
                lastActivity.merge(id(row[0]), (Timestamp) row[1], CoordinatorDashboardController::later);
            }
        }

        List<DocumentRequirement> requirements = new ArrayList<>();
        for (String type : StudentProgressService.REQ_TYPES) requirements.addAll(snap.reqs().getOrDefault(type, List.of()));
        Map<String, Cell> reqCells = cells(requirements.isEmpty() || studentIds.isEmpty() ? List.of()
                : attachmentRepository.findTimeline(requirements.stream().map(DocumentRequirement::getId).toList()));
        Map<String, Cell> dtrCells = cells(snap.dtrs().isEmpty() || studentIds.isEmpty() ? List.of()
                : signedDtrRepository.findTimeline(snap.dtrs().stream().map(MonthlyDtr::getId).toList()));

        LocalDateTime now = LocalDateTime.now();
        Timestamp inactiveSince = Timestamp.valueOf(now.minusDays(INACTIVE_DAYS));

        List<AttentionRow> attention = new ArrayList<>();
        List<AlmostDoneRow> almost = new ArrayList<>();
        List<UnassignedRow> unassigned = new ArrayList<>();
        List<InactiveRow> inactive = new ArrayList<>();
        List<NamedRow> withoutDuration = new ArrayList<>();
        Map<String, Integer> gender = new LinkedHashMap<>();
        Map<String, Integer> status = new LinkedHashMap<>();
        Map<String, Integer> employability = new LinkedHashMap<>();
        int[] buckets = new int[4];
        Map<Long, Integer> studentsByCompany = new HashMap<>();
        BigDecimal rendered = BigDecimal.ZERO;
        BigDecimal required = BigDecimal.ZERO;
        int progressSum = 0;

        for (Student s : students) {
            List<Category> categories = progress.categories(s, snap, false);
            int overall = StudentProgressService.overall(categories);
            progressSum += overall;
            buckets[overall <= 25 ? 0 : overall <= 50 ? 1 : overall <= 75 ? 2 : 3]++;

            String name = name(s);
            String st = s.getStatus() == null ? "" : s.getStatus().trim();
            boolean assigned = s.getDepartment() != null;
            boolean started = assigned && "Deployed".equalsIgnoreCase(st);

            if (started && overall < LOW_PROGRESS) {
                attention.add(new AttentionRow(s.getId(), name, overall, reasons(s, categories, snap)));
            }

            BigDecimal hours = progress.dtrHours(s, snap);
            rendered = rendered.add(hours);
            BigDecimal duration = s.getTrainingDuration();
            boolean hasDuration = duration != null && duration.signum() > 0;
            if (hasDuration) required = required.add(duration);
            else withoutDuration.add(new NamedRow(s.getId(), name));

            if (overall >= HIGH_PROGRESS) {
                BigDecimal remaining = hasDuration ? duration.subtract(hours).max(BigDecimal.ZERO) : null;
                almost.add(new AlmostDoneRow(s.getId(), name, overall, remaining));
            }

            if (assigned) {
                Company c = s.getDepartment().getCompany();
                if (c != null) studentsByCompany.merge(c.getId(), 1, Integer::sum);
            } else {
                unassigned.add(new UnassignedRow(s.getId(), name, st.isEmpty() ? "For Approval" : st));
            }

            if (!"Completed".equalsIgnoreCase(st)) {
                Timestamp last = lastActivity.get(s.getId());
                if (last == null || last.before(inactiveSince)) {
                    inactive.add(new InactiveRow(s.getId(), name, st, last == null ? null : last.toLocalDateTime()));
                }
            }

            gender.merge(label(s.getGender(), "Not set"), 1, Integer::sum);
            status.merge(statusLabel(st), 1, Integer::sum);
            String level = s.getPredictedEmployabilityLevel();
            if (level != null && !level.isBlank()) employability.merge(label(level, ""), 1, Integer::sum);
        }

        attention.sort(Comparator.comparingInt(AttentionRow::overall).thenComparing(AttentionRow::name));
        almost.sort(Comparator.comparingInt(AlmostDoneRow::overall).reversed().thenComparing(AlmostDoneRow::name));
        inactive.sort(Comparator.comparing(InactiveRow::lastActivity, Comparator.nullsFirst(Comparator.naturalOrder()))
                .thenComparing(InactiveRow::name));

        // Top companies ayon sa dami ng student
        Map<Long, Integer> deptsByCompany = new HashMap<>();
        for (Department d : departments) deptsByCompany.merge(d.getCompany().getId(), 1, Integer::sum);
        List<CompanyRow> topCompanies = companies.stream()
                .filter(c -> studentsByCompany.getOrDefault(c.getId(), 0) > 0)
                .map(c -> new CompanyRow(c.getId(), c.getName(), studentsByCompany.get(c.getId()),
                        deptsByCompany.getOrDefault(c.getId(), 0)))
                .sorted(Comparator.comparingInt(CompanyRow::students).reversed().thenComparing(CompanyRow::name))
                .limit(5)
                .toList();

        Submissions submissions = submissions(students, requirements, snap.dtrs(), reqCells, dtrCells, slotUpload, now);

        Dashboard body = new Dashboard(
                new SemesterInfo(semester.getId(), semester.getSemester()),
                now,
                new Totals(students.size(), companies.size(), departments.size()),
                students.isEmpty() ? 0 : Math.round((float) progressSum / students.size()),
                attention, attention.size(),
                almost, almost.size(),
                unassigned,
                new Deployment(students.size() - unassigned.size(), unassigned.size()),
                inactive, inactive.size(),
                counts(gender, List.of()),
                counts(status, STATUS_ORDER),
                List.of(new Count("0–25%", buckets[0]), new Count("26–50%", buckets[1]),
                        new Count("51–75%", buckets[2]), new Count("76–100%", buckets[3])),
                topCompanies,
                submissions,
                new Hours(rendered.stripTrailingZeros(), required.stripTrailingZeros(), withoutDuration.size(), limit(withoutDuration)),
                counts(employability, List.of()));
        return ResponseEntity.ok(body);
    }

    // ---------------------------------------------------------------------

    /**
     * On time / late / missing / hindi pa due, bawat student at bawat requirement o buwan ng DTR na may due date.
     * Ang "late" ay batay sa pinakahuling upload (walang hiwalay na oras ng pag-turn in).
     * Post requirements at DTR ay binibilang lang sa Deployed o Completed (hindi pa nila ito makikita bago noon).
     */
    private Submissions submissions(List<Student> students, List<DocumentRequirement> requirements, List<MonthlyDtr> dtrs,
                                    Map<String, Cell> reqCells, Map<String, Cell> dtrCells,
                                    Map<String, Timestamp> slotUpload, LocalDateTime now) {
        int[] req = new int[4];
        int[] dtr = new int[4];
        Map<String, Integer> missingBy = new LinkedHashMap<>();
        Timestamp nowTs = Timestamp.valueOf(now);

        for (Student s : students) {
            String st = s.getStatus() == null ? "" : s.getStatus().trim();
            boolean deployed = "Deployed".equalsIgnoreCase(st) || "Completed".equalsIgnoreCase(st);

            for (DocumentRequirement r : requirements) {
                if ("post".equalsIgnoreCase(r.getType()) && !deployed) continue;
                if (EvaluationAccess.isClosed(s, r)) continue;
                Cell cell = reqCells.get(s.getId() + "-" + r.getId());
                int k = classify(cell, slotUpload.get(s.getId() + "-" + StudentWorkService.REQUIREMENT + "-" + r.getId()),
                        r.getDueDate(), nowTs);
                req[k]++;
                if (k == 2) missingBy.merge("requirement|" + r.getTitle(), 1, Integer::sum);
            }
            if (!deployed) continue;
            for (MonthlyDtr d : dtrs) {
                Cell cell = dtrCells.get(s.getId() + "-" + d.getId());
                int k = classify(cell, slotUpload.get(s.getId() + "-" + StudentWorkService.DTR + "-" + d.getId()),
                        d.getDueDate(), nowTs);
                dtr[k]++;
                if (k == 2) missingBy.merge("dtr|DTR " + d.getMonth(), 1, Integer::sum);
            }
        }

        List<MissingItem> most = missingBy.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .limit(3)
                .map(e -> {
                    String[] parts = e.getKey().split("\\|", 2);
                    return new MissingItem(parts[0], parts[1], e.getValue());
                })
                .toList();
        return new Submissions(new Timeliness(req[0], req[1], req[2], req[3]),
                new Timeliness(dtr[0], dtr[1], dtr[2], dtr[3]), most);
    }

    /** 0 = on time, 1 = late, 2 = missing, 3 = hindi pa due */
    private static int classify(Cell cell, Timestamp lastUpload, Timestamp due, Timestamp now) {
        String st = cell == null ? "ASSIGNED" : cell.status();
        boolean turnedIn = st.equals("CHECKED") || st.equals("FOR_CHECKING");
        if (turnedIn) {
            if (due == null) return 0;
            Timestamp at = lastUpload != null ? lastUpload : cell.updatedAt();
            return at != null && at.after(due) ? 1 : 0;
        }
        return due != null && due.before(now) ? 2 : 3;
    }

    /** Hanggang dalawang maikling dahilan, mula sa pinakamahinang bahagi ng progress */
    private List<String> reasons(Student s, List<Category> categories, Snapshot snap) {
        List<String> out = new ArrayList<>();
        int unchecked = 0;
        int invalid = 0;
        for (Category c : categories) {
            if (c.key().equals("dtr") && c.total() > 0 && c.done() == 0) out.add("0 DTR hours");
        }
        for (String type : StudentProgressService.REQ_TYPES) {
            for (DocumentRequirement r : snap.reqs().getOrDefault(type, List.of())) {
                if (EvaluationAccess.isClosed(s, r)) continue;
                String st = snap.status().getOrDefault(s.getId() + "-" + r.getId(), "ASSIGNED");
                if (st.equals("INVALID")) invalid++;
                if (!st.equals("CHECKED")) unchecked++;
            }
        }
        if (invalid > 0) out.add(plural(invalid, "requirement") + " returned as invalid");
        for (Category c : categories) {
            if (c.key().equals("weekly") && c.total() > c.done()) {
                out.add(plural(c.total() - c.done(), "weekly report") + " not rated yet");
            }
        }
        if (unchecked > 0) out.add(plural(unchecked, "requirement") + " not checked yet");
        return out.size() > 2 ? out.subList(0, 2) : out;
    }

    private static Map<String, Cell> cells(List<Object[]> rows) {
        Map<String, Cell> out = new HashMap<>();
        for (Object[] row : rows) {
            Cell next = new Cell(StudentProgressService.normalize((String) row[2]), (Timestamp) row[3]);
            out.merge(id(row[0]) + "-" + id(row[1]), next, (a, b) -> {
                String st = StudentProgressService.strongest(a.status(), b.status());
                return new Cell(st, later(a.updatedAt(), b.updatedAt()));
            });
        }
        return out;
    }

    private static List<Count> counts(Map<String, Integer> map, List<String> order) {
        List<Count> out = new ArrayList<>();
        for (String key : order) {
            Integer n = map.get(key);
            if (n != null) out.add(new Count(key, n));
        }
        map.entrySet().stream()
                .filter(e -> !order.contains(e.getKey()))
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .forEach(e -> out.add(new Count(e.getKey(), e.getValue())));
        return out;
    }

    private static String statusLabel(String raw) {
        if (raw == null || raw.isBlank()) return "For Approval";
        for (String known : STATUS_ORDER) if (known.equalsIgnoreCase(raw)) return known;
        return raw;
    }

    /** "male" / "MALE" → "Male"; walang laman → fallback */
    private static String label(String raw, String fallback) {
        if (raw == null || raw.isBlank()) return fallback;
        String t = raw.trim();
        return t.substring(0, 1).toUpperCase() + t.substring(1).toLowerCase();
    }

    private static String name(Student s) {
        String last = s.getLastname() == null ? "" : s.getLastname().trim();
        String first = s.getFirstname() == null ? "" : s.getFirstname().trim();
        return last.isEmpty() ? first : last + ", " + first;
    }

    private static String plural(int n, String word) {
        return n + " " + word + (n == 1 ? "" : "s");
    }

    private static <T> List<T> limit(List<T> list) {
        return list.size() > LIST_LIMIT ? List.copyOf(list.subList(0, LIST_LIMIT)) : list;
    }

    private static Timestamp later(Timestamp a, Timestamp b) {
        if (a == null) return b;
        if (b == null) return a;
        return a.after(b) ? a : b;
    }

    private static long id(Object o) {
        return ((Number) o).longValue();
    }
}
