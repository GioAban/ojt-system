package com.iodev.practicum.controller;

import com.iodev.practicum.model.DocumentRequirement;
import com.iodev.practicum.model.MonthlyDtr;
import com.iodev.practicum.model.MonthlyWeeklyReport;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.DocumentRequirementAttachmentRepository;
import com.iodev.practicum.repository.DocumentRequirementRepository;
import com.iodev.practicum.repository.MonthlyDtrRepository;
import com.iodev.practicum.repository.MonthlyWeeklyReportRepository;
import com.iodev.practicum.repository.SignedDtrRepository;
import com.iodev.practicum.repository.SignedWeeklyReportRepository;
import com.iodev.practicum.repository.StudentManagementRepository;
import com.iodev.practicum.repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Progress ng student: ang sarili niyang detalye (/me) at ang buod ng mga kasabay niya (/class).
 * Parehong batayan ng Tracking ng coordinator: Checked ang requirement, may rating ang weekly report,
 * at may oras ang DTR.
 */
@RestController
@RequestMapping("/api/student/progress")
public class StudentProgressController {

    private static final List<String> REQ_TYPES = List.of("initial", "pre", "post");
    private static final Map<String, String> REQ_LABELS = Map.of(
            "initial", "Initial requirements",
            "pre", "Preliminary requirements",
            "post", "Post requirements");
    private static final Map<Integer, String> RATINGS = Map.of(
            4, "Excellent", 3, "Very good", 2, "Good", 1, "Poor");
    private static final DateTimeFormatter SHORT = DateTimeFormatter.ofPattern("MMM d");

    public record Item(String label, String detail, String state) {}

    public record Category(String key, String label, int percent, int done, int total, String unit, List<Item> items) {}

    public record Me(int overall, List<Category> categories) {}

    public record ClassRow(String label, boolean me, int overall, Map<String, Integer> categories) {}

    public record ClassData(int average, List<ClassRow> students) {}

    @Autowired private StudentManagementRepository studentManagementRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private DocumentRequirementRepository requirementRepository;
    @Autowired private DocumentRequirementAttachmentRepository attachmentRepository;
    @Autowired private MonthlyWeeklyReportRepository weeklyRepository;
    @Autowired private SignedWeeklyReportRepository signedWeeklyRepository;
    @Autowired private MonthlyDtrRepository dtrRepository;
    @Autowired private SignedDtrRepository signedDtrRepository;

    private record Snapshot(Map<String, List<DocumentRequirement>> reqs, Map<String, String> status,
                            List<MonthlyWeeklyReport> weeks, Map<String, Integer> ratings,
                            List<MonthlyDtr> dtrs, Map<String, BigDecimal> hours) {}

    @GetMapping("/me")
    @Transactional(readOnly = true)
    public ResponseEntity<?> me(Authentication authentication) {
        Student s = current(authentication);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");
        if (s.getCoordinator() == null || s.getSemester() == null) {
            return ResponseEntity.ok(new Me(0, List.of()));
        }
        Snapshot snap = load(s.getCoordinator().getId(), s.getSemester().getId(), List.of(s));

        List<Category> categories = new ArrayList<>();
        for (String type : REQ_TYPES) categories.add(requirementCategory(s, type, snap, true));
        categories.add(dtrCategory(s, snap, true));
        categories.add(weeklyCategory(s, snap, true));
        return ResponseEntity.ok(new Me(overall(categories), categories));
    }

    @GetMapping("/class")
    @Transactional(readOnly = true)
    public ResponseEntity<?> classmates(Authentication authentication) {
        Student me = current(authentication);
        if (me == null) return ResponseEntity.status(403).body("Student account not found.");
        if (me.getCoordinator() == null || me.getSemester() == null) {
            return ResponseEntity.ok(new ClassData(0, List.of()));
        }
        Long coordinatorId = me.getCoordinator().getId();
        Long semesterId = me.getSemester().getId();

        List<Student> students = new ArrayList<>(studentRepository.findForTracking(coordinatorId, semesterId));
        if (students.stream().noneMatch(x -> x.getId().equals(me.getId()))) students.add(me);

        Snapshot snap = load(coordinatorId, semesterId, students);

        List<ClassRow> others = new ArrayList<>();
        ClassRow mine = null;
        int sum = 0;
        for (Student s : students) {
            List<Category> categories = new ArrayList<>();
            for (String type : REQ_TYPES) categories.add(requirementCategory(s, type, snap, false));
            categories.add(dtrCategory(s, snap, false));
            categories.add(weeklyCategory(s, snap, false));

            Map<String, Integer> byKey = new LinkedHashMap<>();
            for (Category c : categories) byKey.put(c.key(), c.total() == 0 ? -1 : c.percent());
            int overall = overall(categories);
            sum += overall;

            boolean isMe = s.getId().equals(me.getId());
            ClassRow row = new ClassRow(isMe ? "You" : shortName(s), isMe, overall, byKey);
            if (isMe) mine = row;
            else others.add(row);
        }
        others.sort(Comparator.comparing(ClassRow::label, String.CASE_INSENSITIVE_ORDER));

        List<ClassRow> out = new ArrayList<>();
        if (mine != null) out.add(mine);
        out.addAll(others);
        return ResponseEntity.ok(new ClassData(students.isEmpty() ? 0 : Math.round((float) sum / students.size()), out));
    }

    // ---------------------------------------------------------------------

    private Snapshot load(Long coordinatorId, Long semesterId, List<Student> students) {
        Map<String, List<DocumentRequirement>> reqs = new LinkedHashMap<>();
        List<Long> requirementIds = new ArrayList<>();
        for (String type : REQ_TYPES) {
            List<DocumentRequirement> list = requirementRepository.findForTracking(coordinatorId, semesterId, type);
            reqs.put(type, list);
            for (DocumentRequirement r : list) requirementIds.add(r.getId());
        }

        Map<String, String> status = new HashMap<>();
        if (!requirementIds.isEmpty() && !students.isEmpty()) {
            for (Object[] row : attachmentRepository.findStatuses(requirementIds)) {
                String key = id(row[0]) + "-" + id(row[1]);
                status.merge(key, normalize((String) row[2]), StudentProgressController::strongest);
            }
        }

        List<MonthlyWeeklyReport> weeks = weeklyRepository.findForTracking(coordinatorId, semesterId);
        Map<String, Integer> ratings = new HashMap<>();
        if (!weeks.isEmpty() && !students.isEmpty()) {
            List<Long> ids = weeks.stream().map(MonthlyWeeklyReport::getId).toList();
            for (Object[] row : signedWeeklyRepository.findRatings(ids)) {
                if (row[2] != null) ratings.put(id(row[0]) + "-" + id(row[1]), ((Number) row[2]).intValue());
            }
        }

        List<MonthlyDtr> dtrs = dtrRepository.findForTracking(coordinatorId, semesterId);
        Map<String, BigDecimal> hours = new HashMap<>();
        if (!dtrs.isEmpty() && !students.isEmpty()) {
            List<Long> ids = dtrs.stream().map(MonthlyDtr::getId).toList();
            for (Object[] row : signedDtrRepository.findHours(ids)) {
                if (row[2] != null) hours.put(id(row[0]) + "-" + id(row[1]), (BigDecimal) row[2]);
            }
        }
        return new Snapshot(reqs, status, weeks, ratings, dtrs, hours);
    }

    private Category requirementCategory(Student s, String type, Snapshot snap, boolean withItems) {
        List<DocumentRequirement> list = snap.reqs().getOrDefault(type, List.of());
        int done = 0;
        List<Item> items = new ArrayList<>();
        for (DocumentRequirement r : list) {
            String st = snap.status().getOrDefault(s.getId() + "-" + r.getId(), "ASSIGNED");
            if (st.equals("CHECKED")) done++;
            if (withItems) {
                String due = r.getDueDate() == null ? "" : "Due " + r.getDueDate();
                items.add(new Item(r.getTitle(), due, switch (st) {
                    case "CHECKED" -> "done";
                    case "FOR_CHECKING" -> "review";
                    case "INVALID" -> "invalid";
                    default -> "pending";
                }));
            }
        }
        return new Category(type, REQ_LABELS.get(type), percent(done, list.size()), done, list.size(), "checked", items);
    }

    private Category weeklyCategory(Student s, Snapshot snap, boolean withItems) {
        int done = 0;
        List<Item> items = new ArrayList<>();
        for (MonthlyWeeklyReport w : snap.weeks()) {
            Integer rating = snap.ratings().get(s.getId() + "-" + w.getId());
            if (rating != null) done++;
            if (withItems) {
                String label = w.getMonthFrom().toLocalDate().format(SHORT) + " – " + w.getMonthTo().toLocalDate().format(SHORT);
                items.add(new Item(label, rating == null ? "" : RATINGS.getOrDefault(rating, ""), rating == null ? "pending" : "done"));
            }
        }
        return new Category("weekly", "Weekly reports", percent(done, snap.weeks().size()), done, snap.weeks().size(), "rated", items);
    }

    private Category dtrCategory(Student s, Snapshot snap, boolean withItems) {
        BigDecimal total = BigDecimal.ZERO;
        int months = 0;
        List<Item> items = new ArrayList<>();
        for (MonthlyDtr d : snap.dtrs()) {
            BigDecimal h = snap.hours().get(s.getId() + "-" + d.getId());
            if (h != null) {
                total = total.add(h);
                months++;
            }
            if (withItems) {
                items.add(new Item(d.getMonth(), h == null ? "" : h.stripTrailingZeros().toPlainString() + " hrs",
                        h == null ? "pending" : "done"));
            }
        }
        Number duration = s.getTrainingDuration();
        if (duration != null && duration.intValue() > 0) {
            int required = duration.intValue();
            int done = total.intValue();
            return new Category("dtr", "DTR (hours rendered)", percent(Math.min(done, required), required),
                    done, required, "hours", items);
        }
        return new Category("dtr", "DTR (hours rendered)", percent(months, snap.dtrs().size()),
                months, snap.dtrs().size(), "months", items);
    }

    /** Karaniwan ng mga kategoryang may laman (walang requirement = hindi kasama) */
    private static int overall(List<Category> categories) {
        int sum = 0, n = 0;
        for (Category c : categories) {
            if (c.total() == 0) continue;
            sum += c.percent();
            n++;
        }
        return n == 0 ? 0 : Math.round((float) sum / n);
    }

    private static int percent(int done, int total) {
        if (total <= 0) return 0;
        return Math.min(100, Math.round(done * 100f / total));
    }

    private static String shortName(Student s) {
        String first = s.getFirstname() == null ? "" : s.getFirstname().trim();
        String last = s.getLastname() == null ? "" : s.getLastname().trim();
        return (first + (last.isEmpty() ? "" : " " + last.charAt(0) + ".")).trim();
    }

    private static long id(Object o) {
        return ((Number) o).longValue();
    }

    private static String normalize(String raw) {
        if (raw == null) return "ASSIGNED";
        return switch (raw.trim().toLowerCase().replace('_', ' ')) {
            case "checked" -> "CHECKED";
            case "for checking" -> "FOR_CHECKING";
            case "invalid" -> "INVALID";
            default -> "ASSIGNED";
        };
    }

    private static int rank(String status) {
        return switch (status) {
            case "INVALID" -> 3;
            case "FOR_CHECKING" -> 2;
            case "CHECKED" -> 1;
            default -> 0;
        };
    }

    private static String strongest(String a, String b) {
        return rank(a) >= rank(b) ? a : b;
    }

    private Student current(Authentication authentication) {
        if (authentication == null) return null;
        return studentManagementRepository.findByEmail(authentication.getName()).stream()
                .max(Comparator.comparing(Student::getId))
                .orElse(null);
    }
}
