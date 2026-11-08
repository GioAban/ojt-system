package com.iodev.practicum.service;

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
import com.iodev.practicum.util.EvaluationAccess;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Iisang batayan ng progress ng student (ginagamit ng Progress page ng student at ng Dashboard ng coordinator).
 * Checked ang requirement, may rating ang weekly report, at may oras ang DTR.
 * Overall = karaniwan ng mga kategoryang may laman.
 */
@Service
public class StudentProgressService {

    public static final List<String> REQ_TYPES = List.of("initial", "pre", "post");
    private static final Map<String, String> REQ_LABELS = Map.of(
            "initial", "Initial requirements",
            "pre", "Preliminary requirements",
            "post", "Post requirements");
    private static final Map<Integer, String> RATINGS = Map.of(
            4, "Excellent", 3, "Very good", 2, "Good", 1, "Poor");
    private static final DateTimeFormatter SHORT = DateTimeFormatter.ofPattern("MMM d");

    public record Item(String label, String detail, String state) {}

    public record Category(String key, String label, int percent, int done, int total, String unit, List<Item> items) {}

    /** Lahat ng kailangan para kuwentahin ang progress ng mga student ng isang coordinator sa isang semester */
    public record Snapshot(Map<String, List<DocumentRequirement>> reqs, Map<String, String> status,
                           List<MonthlyWeeklyReport> weeks, Map<String, Integer> ratings,
                           List<MonthlyDtr> dtrs, Map<String, BigDecimal> hours) {}

    @Autowired private DocumentRequirementRepository requirementRepository;
    @Autowired private DocumentRequirementAttachmentRepository attachmentRepository;
    @Autowired private MonthlyWeeklyReportRepository weeklyRepository;
    @Autowired private SignedWeeklyReportRepository signedWeeklyRepository;
    @Autowired private MonthlyDtrRepository dtrRepository;
    @Autowired private SignedDtrRepository signedDtrRepository;

    public Snapshot load(Long coordinatorId, Long semesterId, List<Student> students) {
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
                status.merge(key, normalize((String) row[2]), StudentProgressService::strongest);
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

    /** Lahat ng kategorya ng isang student, sa parehong ayos ng Progress page */
    public List<Category> categories(Student s, Snapshot snap, boolean withItems) {
        List<Category> categories = new ArrayList<>();
        for (String type : REQ_TYPES) categories.add(requirementCategory(s, type, snap, withItems));
        categories.add(dtrCategory(s, snap, withItems));
        categories.add(weeklyCategory(s, snap, withItems));
        return categories;
    }

    public Category requirementCategory(Student s, String type, Snapshot snap, boolean withItems) {
        List<DocumentRequirement> list = snap.reqs().getOrDefault(type, List.of());
        int done = 0;
        int total = 0;
        List<Item> items = new ArrayList<>();
        for (DocumentRequirement r : list) {
            // Ang saradong evaluation ay hindi binibilang hanggang mabuksan
            if (EvaluationAccess.isClosed(s, r)) continue;
            total++;
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
        return new Category(type, REQ_LABELS.get(type), percent(done, total), done, total, "checked", items);
    }

    public Category weeklyCategory(Student s, Snapshot snap, boolean withItems) {
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

    public Category dtrCategory(Student s, Snapshot snap, boolean withItems) {
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

    /** Kabuuang oras sa DTR ng student (lahat ng buwan ng snapshot) */
    public BigDecimal dtrHours(Student s, Snapshot snap) {
        BigDecimal total = BigDecimal.ZERO;
        for (MonthlyDtr d : snap.dtrs()) {
            BigDecimal h = snap.hours().get(s.getId() + "-" + d.getId());
            if (h != null) total = total.add(h);
        }
        return total;
    }

    /** Karaniwan ng mga kategoryang may laman (walang requirement = hindi kasama) */
    public static int overall(List<Category> categories) {
        int sum = 0, n = 0;
        for (Category c : categories) {
            if (c.total() == 0) continue;
            sum += c.percent();
            n++;
        }
        return n == 0 ? 0 : Math.round((float) sum / n);
    }

    public static int percent(int done, int total) {
        if (total <= 0) return 0;
        return Math.min(100, Math.round(done * 100f / total));
    }

    private static long id(Object o) {
        return ((Number) o).longValue();
    }

    /** "Checked", "for_checking" at iba pa → CHECKED, FOR_CHECKING, INVALID o ASSIGNED */
    public static String normalize(String raw) {
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

    public static String strongest(String a, String b) {
        return rank(a) >= rank(b) ? a : b;
    }
}
