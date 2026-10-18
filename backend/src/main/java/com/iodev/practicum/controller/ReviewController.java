package com.iodev.practicum.controller;

import com.iodev.practicum.dto.ReviewDtos.*;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.DocumentRequirement;
import com.iodev.practicum.model.DocumentRequirementAttachment;
import com.iodev.practicum.model.MonthlyDtr;
import com.iodev.practicum.model.MonthlyWeeklyReport;
import com.iodev.practicum.model.SignedDtr;
import com.iodev.practicum.model.SignedWeeklyReport;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.DocumentRequirementAttachmentRepository;
import com.iodev.practicum.repository.DocumentRequirementRepository;
import com.iodev.practicum.repository.MonthlyDtrRepository;
import com.iodev.practicum.repository.MonthlyWeeklyReportRepository;
import com.iodev.practicum.repository.SignedDtrRepository;
import com.iodev.practicum.repository.SignedWeeklyReportRepository;
import com.iodev.practicum.repository.StudentRepository;
import com.iodev.practicum.model.SubmissionFile;
import com.iodev.practicum.repository.SubmissionFileRepository;
import com.iodev.practicum.service.S3PresignService;
import com.iodev.practicum.util.SubmissionStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Review ng mga isinumite ng student: weekly reports, DTR, at requirements.
 * Ang bawat cell ay may status (Assigned, For Checking, Checked, Invalid). Ang "Assigned" ang default
 * kapag wala pang naipapasa ang student.
 */
@RestController
@RequestMapping("/api/coordinator/review")
public class ReviewController {

    private static final BigDecimal MAX_HOURS = new BigDecimal("744");
    private static final Map<String, Integer> RATING_VALUES =
            Map.of("EXCELLENT", 4, "VERY_GOOD", 3, "GOOD", 2, "POOR", 1);
    private static final Map<Integer, String> RATING_NAMES =
            Map.of(4, "EXCELLENT", 3, "VERY_GOOD", 2, "GOOD", 1, "POOR");
    private static final ReviewCell EMPTY = new ReviewCell("ASSIGNED", null, null, false);

    @Autowired private CoordinatorRepository coordinatorRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private MonthlyWeeklyReportRepository reportRepository;
    @Autowired private SignedWeeklyReportRepository signedWeekly;
    @Autowired private MonthlyDtrRepository dtrRepository;
    @Autowired private SignedDtrRepository signedDtr;
    @Autowired private DocumentRequirementRepository requirementRepository;
    @Autowired private DocumentRequirementAttachmentRepository attachmentRepository;
    @Autowired private S3PresignService storage;
    @Autowired private SubmissionFileRepository submissionFiles;

    // ---------------------------------------------------------------------
    // Mga listahan
    // ---------------------------------------------------------------------

    @GetMapping("/weekly")
    @Transactional(readOnly = true)
    public ResponseEntity<?> weekly(@RequestParam Long semesterId, Authentication authentication) {
        Coordinator coordinator = coordinator(authentication);
        if (coordinator == null) return noProfile();

        List<MonthlyWeeklyReport> reports = reportRepository.findForTracking(coordinator.getId(), semesterId);
        List<Student> students = studentRepository.findForTracking(coordinator.getId(), semesterId);

        Map<String, ReviewCell> byKey = new HashMap<>();
        if (!reports.isEmpty() && !students.isEmpty()) {
            List<Long> ids = reports.stream().map(MonthlyWeeklyReport::getId).toList();
            for (Object[] row : signedWeekly.findCells(ids)) {
                byKey.put(row[0] + "-" + row[1], new ReviewCell(
                        SubmissionStatus.key((String) row[2]),
                        ratingName((Integer) row[3]),
                        null,
                        hasText((String) row[4])));
            }
        }

        List<WeeklyCol> columns = reports.stream()
                .map(r -> new WeeklyCol(r.getId(), r.getMonthFrom().toLocalDate(), r.getMonthTo().toLocalDate(), r.getDueDate()))
                .toList();

        List<WeeklyStudent> rows = new ArrayList<>();
        for (Student s : students) {
            Map<Long, ReviewCell> cells = new LinkedHashMap<>();
            for (MonthlyWeeklyReport r : reports) {
                cells.put(r.getId(), byKey.getOrDefault(s.getId() + "-" + r.getId(), EMPTY));
            }
            rows.add(new WeeklyStudent(s.getId(), s.getStudentNumber(), s.getFirstname(), s.getLastname(),
                    s.getMiddleInitial(), s.getSubjectCode(), cells));
        }
        return ResponseEntity.ok(new WeeklyReview(semesterId, columns, rows));
    }

    @GetMapping("/dtr")
    @Transactional(readOnly = true)
    public ResponseEntity<?> dtr(@RequestParam Long semesterId, Authentication authentication) {
        Coordinator coordinator = coordinator(authentication);
        if (coordinator == null) return noProfile();

        List<MonthlyDtr> dtrs = dtrRepository.findForTracking(coordinator.getId(), semesterId);
        List<Student> students = studentRepository.findForTracking(coordinator.getId(), semesterId);

        Map<String, ReviewCell> byKey = new HashMap<>();
        if (!dtrs.isEmpty() && !students.isEmpty()) {
            List<Long> ids = dtrs.stream().map(MonthlyDtr::getId).toList();
            for (Object[] row : signedDtr.findCells(ids)) {
                byKey.put(row[0] + "-" + row[1], new ReviewCell(
                        SubmissionStatus.key((String) row[2]),
                        null,
                        (BigDecimal) row[3],
                        hasText((String) row[4])));
            }
        }

        List<DtrCol> columns = dtrs.stream()
                .map(d -> new DtrCol(d.getId(), d.getMonth(), d.getDueDate()))
                .toList();

        List<DtrStudent> rows = new ArrayList<>();
        for (Student s : students) {
            Map<Long, ReviewCell> cells = new LinkedHashMap<>();
            for (MonthlyDtr d : dtrs) {
                cells.put(d.getId(), byKey.getOrDefault(s.getId() + "-" + d.getId(), EMPTY));
            }
            String started = s.getStartTrainingDate() != null ? s.getStartTrainingDate() : s.getDeployedDate();
            rows.add(new DtrStudent(s.getId(), s.getStudentNumber(), s.getFirstname(), s.getLastname(),
                    s.getMiddleInitial(), s.getSubjectCode(), started,
                    requiredHours(s, coordinator), s.getRenderedHours(), cells));
        }
        return ResponseEntity.ok(new DtrReview(semesterId, columns, rows));
    }

    /**
     * Para sa submissions page ng isang linggo (weekly) o buwan (dtr): status, rating, hours at
     * kabuuang rendered hours ng bawat student.
     */
    @GetMapping("/submissions")
    @Transactional(readOnly = true)
    public ResponseEntity<?> submissions(@RequestParam String kind, @RequestParam Long itemId,
                                         Authentication authentication) {
        Coordinator coordinator = coordinator(authentication);
        if (coordinator == null) return noProfile();

        String k = kind == null ? "" : kind.trim().toLowerCase();
        Long semesterId;
        Map<Long, ReviewCell> byStudent = new HashMap<>();

        if (k.equals("weekly")) {
            MonthlyWeeklyReport report = reportRepository.findById(itemId).orElse(null);
            if (report == null) return ResponseEntity.status(404).body("Week not found.");
            if (!report.getCoordinator().getId().equals(coordinator.getId())) {
                return ResponseEntity.status(403).body("You can only view your own weekly reports.");
            }
            semesterId = report.getSemester().getId();
            for (Object[] row : signedWeekly.findCells(List.of(itemId))) {
                byStudent.put(((Number) row[0]).longValue(), new ReviewCell(
                        SubmissionStatus.key((String) row[2]),
                        ratingName((Integer) row[3]),
                        null,
                        hasText((String) row[4])));
            }
        } else if (k.equals("dtr")) {
            MonthlyDtr dtr = dtrRepository.findById(itemId).orElse(null);
            if (dtr == null) return ResponseEntity.status(404).body("Month not found.");
            if (!dtr.getCoordinator().getId().equals(coordinator.getId())) {
                return ResponseEntity.status(403).body("You can only view your own DTRs.");
            }
            semesterId = dtr.getSemester().getId();
            for (Object[] row : signedDtr.findCells(List.of(itemId))) {
                byStudent.put(((Number) row[0]).longValue(), new ReviewCell(
                        SubmissionStatus.key((String) row[2]),
                        null,
                        (BigDecimal) row[3],
                        hasText((String) row[4])));
            }
        } else {
            return bad("Kind must be weekly or dtr.");
        }

        List<SubmissionCell> out = new ArrayList<>();
        for (Student s : studentRepository.findForTracking(coordinator.getId(), semesterId)) {
            ReviewCell cell = byStudent.getOrDefault(s.getId(), EMPTY);
            out.add(new SubmissionCell(s.getId(), cell.status(), cell.rating(), cell.hours(), cell.hasFile(),
                    requiredHours(s, coordinator), s.getRenderedHours()));
        }
        return ResponseEntity.ok(out);
    }

    // ---------------------------------------------------------------------
    // "View work": detalye ng isang cell
    // ---------------------------------------------------------------------

    @GetMapping("/cell")
    @Transactional(readOnly = true)
    public ResponseEntity<?> detail(@RequestParam String kind, @RequestParam Long studentId,
                                    @RequestParam Long itemId, Authentication authentication) {
        Ctx ctx = ctx(kind, studentId, itemId, authentication);
        if (ctx.error() != null) return ctx.error();

        if (ctx.report() != null) {
            SignedWeeklyReport rec = signedWeekly
                    .findFirstByStudentIdAndMonthlyWeeklyReportIdOrderByIdDesc(studentId, itemId).orElse(null);
            if (rec == null) return ResponseEntity.ok(new CellDetail("ASSIGNED", null, null, List.of(), null));
            return ResponseEntity.ok(new CellDetail(SubmissionStatus.key(rec.getStatus()),
                    ratingName(rec.getSupervisorEvaluation()), null, names(paths(ctx)), rec.getUpdatedAt()));
        }
        if (ctx.dtr() != null) {
            SignedDtr rec = signedDtr.findFirstByStudentIdAndMonthlyDtrIdOrderByIdDesc(studentId, itemId).orElse(null);
            if (rec == null) return ResponseEntity.ok(new CellDetail("ASSIGNED", null, null, List.of(), null));
            return ResponseEntity.ok(new CellDetail(SubmissionStatus.key(rec.getStatus()),
                    null, rec.getHours(), names(paths(ctx)), rec.getUpdatedAt()));
        }

        List<DocumentRequirementAttachment> rows =
                attachmentRepository.findByStudentIdAndDocumentRequirementId(studentId, itemId);
        String status = "ASSIGNED";
        Timestamp updated = null;
        for (DocumentRequirementAttachment a : rows) {
            status = strongest(status, SubmissionStatus.key(a.getStatus()));
            if (a.getUpdatedAt() != null && (updated == null || a.getUpdatedAt().after(updated))) {
                updated = a.getUpdatedAt();
            }
        }
        return ResponseEntity.ok(new CellDetail(status, null, null, names(paths(ctx)), updated));
    }

    /** Pansamantalang link para mabuksan ang na-upload na file */
    @GetMapping("/file-url")
    @Transactional(readOnly = true)
    public ResponseEntity<?> fileUrl(@RequestParam String kind, @RequestParam Long studentId,
                                     @RequestParam Long itemId, @RequestParam(defaultValue = "0") int index,
                                     Authentication authentication) {
        Ctx ctx = ctx(kind, studentId, itemId, authentication);
        if (ctx.error() != null) return ctx.error();

        List<String> paths = paths(ctx);
        if (index < 0 || index >= paths.size()) return ResponseEntity.status(404).body("No file was uploaded.");

        try {
            String target = paths.get(index);
            if (target.regionMatches(true, 0, "http://", 0, 7) || target.regionMatches(true, 0, "https://", 0, 8)) {
                return ResponseEntity.ok(new FileUrl(target));
            }
            return ResponseEntity.ok(new FileUrl(storage.presignGet(target, Duration.ofMinutes(10))));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(503).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.status(502).body("Couldn't create a link for that file.");
        }
    }

    // ---------------------------------------------------------------------
    // Pagbabago ng status (at hours / evaluation) ng isang cell
    // ---------------------------------------------------------------------

    @PatchMapping("/cell")
    @Transactional
    public ResponseEntity<?> update(@RequestBody CellRequest request, Authentication authentication) {
        if (request == null) return bad("Request body is required.");

        String key = request.status() == null ? "" : request.status().trim().toUpperCase();
        String stored = SubmissionStatus.stored(key);
        if (stored == null) return bad("Status must be ASSIGNED, FOR_CHECKING, CHECKED, or INVALID.");

        Ctx ctx = ctx(request.kind(), request.studentId(), request.itemId(), authentication);
        if (ctx.error() != null) return ctx.error();

        Timestamp now = new Timestamp(System.currentTimeMillis());

        if (ctx.report() != null) return updateWeekly(ctx, request, key, stored, now);
        if (ctx.dtr() != null) return updateDtr(ctx, request, key, stored, now);
        return updateRequirement(ctx, key, stored, now);
    }

    private ResponseEntity<?> updateWeekly(Ctx ctx, CellRequest request, String key, String stored, Timestamp now) {
        String ratingKey = request.rating() == null ? null : request.rating().trim().toUpperCase();
        boolean clearRating = "NONE".equals(ratingKey);
        Integer ratingValue = ratingKey == null ? null : RATING_VALUES.get(ratingKey);
        if (ratingKey != null && !clearRating && ratingValue == null) {
            return bad("Rating must be EXCELLENT, VERY_GOOD, GOOD, POOR, or NONE.");
        }

        SignedWeeklyReport rec = signedWeekly
                .findFirstByStudentIdAndMonthlyWeeklyReportIdOrderByIdDesc(ctx.student().getId(), ctx.report().getId())
                .orElse(null);

        // Ang Checked at ang evaluation ay magkasama: walang Checked na walang evaluation, at ang evaluation
        // ay para lang sa Checked.
        Integer resulting = clearRating ? null : ratingValue != null ? ratingValue
                : rec == null ? null : rec.getSupervisorEvaluation();
        if (key.equals("CHECKED") && resulting == null) {
            return bad("Select an evaluation before marking this weekly report as Checked.");
        }
        if (ratingValue != null && !key.equals("CHECKED")) {
            return bad("An evaluation can only be given to a Checked weekly report.");
        }
        if (!key.equals("CHECKED")) resulting = null;

        if (rec == null) {
            if (key.equals("ASSIGNED") && ratingValue == null) {
                return ResponseEntity.ok(new CellResult(EMPTY, null));
            }
            rec = new SignedWeeklyReport();
            rec.setMonthlyWeeklyReport(ctx.report());
            rec.setStudent(ctx.student());
            rec.setCreatedAt(now);
        }

        rec.setStatus(stored);
        rec.setSupervisorEvaluation(resulting);
        rec.setUpdatedAt(now);
        signedWeekly.save(rec);

        return ResponseEntity.ok(new CellResult(
                new ReviewCell(key, ratingName(rec.getSupervisorEvaluation()), null, hasText(rec.getFilePath())), null));
    }

    private ResponseEntity<?> updateDtr(Ctx ctx, CellRequest request, String key, String stored, Timestamp now) {
        BigDecimal hours = request.hours() == null ? null : request.hours().setScale(2, RoundingMode.HALF_UP);
        if (hours != null && (hours.signum() < 0 || hours.compareTo(MAX_HOURS) > 0)) {
            return bad("Hours must be between 0 and 744.");
        }
        boolean clearHours = Boolean.TRUE.equals(request.clearHours()) && hours == null;

        SignedDtr rec = signedDtr
                .findFirstByStudentIdAndMonthlyDtrIdOrderByIdDesc(ctx.student().getId(), ctx.dtr().getId())
                .orElse(null);

        BigDecimal resulting = clearHours ? null : hours != null ? hours : rec == null ? null : rec.getHours();
        if (key.equals("CHECKED") && resulting == null) {
            return bad("Enter the hours rendered before marking this DTR as Checked.");
        }

        if (rec == null) {
            if (key.equals("ASSIGNED") && hours == null) {
                return ResponseEntity.ok(new CellResult(EMPTY, ctx.student().getRenderedHours()));
            }
            rec = new SignedDtr();
            rec.setMonthlyDtr(ctx.dtr());
            rec.setStudent(ctx.student());
            rec.setCreatedAt(now);
        }

        rec.setHours(resulting);
        rec.setStatus(stored);
        rec.setUpdatedAt(now);
        signedDtr.save(rec);

        BigDecimal total = syncRenderedHours(ctx.student());
        return ResponseEntity.ok(new CellResult(
                new ReviewCell(key, null, rec.getHours(), hasText(rec.getFilePath())), total));
    }

    private ResponseEntity<?> updateRequirement(Ctx ctx, String key, String stored, Timestamp now) {
        List<DocumentRequirementAttachment> rows = attachmentRepository
                .findByStudentIdAndDocumentRequirementId(ctx.student().getId(), ctx.requirement().getId());

        if (rows.isEmpty()) {
            if (key.equals("ASSIGNED")) return ResponseEntity.ok(new CellResult(EMPTY, null));

            // Wala pang naipapasa: gumawa ng record na walang file para maitala ang status
            DocumentRequirementAttachment record = new DocumentRequirementAttachment();
            record.setDocumentRequirement(ctx.requirement());
            record.setStudent(ctx.student());
            record.setFilePath(null);
            record.setStatus(stored);
            record.setCreatedAt(now);
            record.setUpdatedAt(now);
            attachmentRepository.save(record);
        } else {
            // Hindi binubura ang file, status lang ang nagbabago
            for (DocumentRequirementAttachment a : rows) {
                a.setStatus(stored);
                a.setUpdatedAt(now);
            }
            attachmentRepository.saveAll(rows);
        }
        return ResponseEntity.ok(new CellResult(new ReviewCell(key, null, null, false), null));
    }

    // ---------------------------------------------------------------------
    // Mga helper
    // ---------------------------------------------------------------------

    /** Ang rendered hours ng student ay ang kabuuan ng mga DTR na Checked lang */
    private BigDecimal syncRenderedHours(Student student) {
        BigDecimal total = signedDtr.totalHours(student.getId());
        BigDecimal rounded = (total == null ? BigDecimal.ZERO : total).setScale(2, RoundingMode.HALF_UP);
        student.setRenderedHours(rounded);
        studentRepository.save(student);
        return rounded;
    }

    private record Ctx(Coordinator coordinator, Student student, MonthlyWeeklyReport report, MonthlyDtr dtr,
                       DocumentRequirement requirement, ResponseEntity<?> error) {
        static Ctx fail(ResponseEntity<?> error) {
            return new Ctx(null, null, null, null, null, error);
        }
    }

    /** Sinusuri na sa coordinator ang student at ang item, at na pareho sila ng semester */
    private Ctx ctx(String rawKind, Long studentId, Long itemId, Authentication authentication) {
        String kind = rawKind == null ? "" : rawKind.trim().toLowerCase();
        if (!List.of("weekly", "dtr", "requirement").contains(kind)) {
            return Ctx.fail(bad("Kind must be weekly, dtr, or requirement."));
        }
        if (studentId == null || itemId == null) return Ctx.fail(bad("Student and item are required."));

        Coordinator coordinator = coordinator(authentication);
        if (coordinator == null) return Ctx.fail(noProfile());

        Student student = studentRepository.findById(studentId).orElse(null);
        if (student == null) return Ctx.fail(ResponseEntity.status(404).body("Student not found."));
        if (!student.getCoordinator().getId().equals(coordinator.getId())) {
            return Ctx.fail(ResponseEntity.status(403).body("You can only review your own students."));
        }

        Long studentSemester = student.getSemester().getId();
        String foreign = "That item doesn't belong to you or to the student's semester.";

        if (kind.equals("weekly")) {
            MonthlyWeeklyReport report = reportRepository.findById(itemId).orElse(null);
            if (report == null) return Ctx.fail(ResponseEntity.status(404).body("Week not found."));
            if (!report.getCoordinator().getId().equals(coordinator.getId())
                    || !report.getSemester().getId().equals(studentSemester)) {
                return Ctx.fail(ResponseEntity.status(403).body(foreign));
            }
            return new Ctx(coordinator, student, report, null, null, null);
        }
        if (kind.equals("dtr")) {
            MonthlyDtr dtr = dtrRepository.findById(itemId).orElse(null);
            if (dtr == null) return Ctx.fail(ResponseEntity.status(404).body("Month not found."));
            if (!dtr.getCoordinator().getId().equals(coordinator.getId())
                    || !dtr.getSemester().getId().equals(studentSemester)) {
                return Ctx.fail(ResponseEntity.status(403).body(foreign));
            }
            return new Ctx(coordinator, student, null, dtr, null, null);
        }

        DocumentRequirement requirement = requirementRepository.findById(itemId).orElse(null);
        if (requirement == null) return Ctx.fail(ResponseEntity.status(404).body("Requirement not found."));
        if (!requirement.getCoordinator().getId().equals(coordinator.getId())
                || !requirement.getSemester().getId().equals(studentSemester)) {
            return Ctx.fail(ResponseEntity.status(403).body(foreign));
        }
        return new Ctx(coordinator, student, null, null, requirement, null);
    }

    /** Mga path ng file (o link) ng student. Ang mga nilagay niya sa page ng gawain ang inuuna. */
    private List<String> paths(Ctx ctx) {
        List<String> out = new ArrayList<>();
        Long studentId = ctx.student().getId();
        String scope;
        Long refId;
        if (ctx.report() != null) { scope = "weekly"; refId = ctx.report().getId(); }
        else if (ctx.dtr() != null) { scope = "dtr"; refId = ctx.dtr().getId(); }
        else { scope = "requirement"; refId = ctx.requirement().getId(); }

        for (SubmissionFile f : submissionFiles.findByStudentIdAndScopeAndRefIdOrderByIdAsc(studentId, scope, refId)) {
            if (hasText(f.getPath())) out.add(f.getPath());
        }
        if (!out.isEmpty()) return out;

        if (ctx.report() != null) {
            signedWeekly.findFirstByStudentIdAndMonthlyWeeklyReportIdOrderByIdDesc(studentId, ctx.report().getId())
                    .ifPresent(r -> { if (hasText(r.getFilePath())) out.add(r.getFilePath()); });
        } else if (ctx.dtr() != null) {
            signedDtr.findFirstByStudentIdAndMonthlyDtrIdOrderByIdDesc(studentId, ctx.dtr().getId())
                    .ifPresent(r -> { if (hasText(r.getFilePath())) out.add(r.getFilePath()); });
        } else {
            for (DocumentRequirementAttachment a :
                    attachmentRepository.findByStudentIdAndDocumentRequirementId(studentId, ctx.requirement().getId())) {
                if (hasText(a.getFilePath())) out.add(a.getFilePath());
            }
        }
        return out;
    }

    private static List<String> names(List<String> paths) {
        List<String> out = new ArrayList<>();
        for (String p : paths) {
            if (p.regionMatches(true, 0, "http://", 0, 7) || p.regionMatches(true, 0, "https://", 0, 8)) {
                String host = p.replaceFirst("(?i)^https?://", "");
                int end = host.indexOf('/');
                out.add("Link: " + (end > 0 ? host.substring(0, end) : host));
                continue;
            }
            String trimmed = p.replace('\\', '/');
            int slash = trimmed.lastIndexOf('/');
            String fileName = slash >= 0 ? trimmed.substring(slash + 1) : trimmed;
            out.add(fileName.replaceFirst("^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}-", ""));
        }
        return out;
    }

    private static String strongest(String a, String b) {
        return rank(a) >= rank(b) ? a : b;
    }

    private static int rank(String status) {
        return switch (status) {
            case "INVALID" -> 3;
            case "FOR_CHECKING" -> 2;
            case "CHECKED" -> 1;
            default -> 0;
        };
    }

    private static String ratingName(Integer value) {
        return value == null ? null : RATING_NAMES.get(value);
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    /** Required hours: ang sa student kung meron, kung wala ay ang training duration ng program */
    private static BigDecimal requiredHours(Student s, Coordinator coordinator) {
        if (s.getTrainingDuration() != null) return s.getTrainingDuration();
        return coordinator.getProgram() == null ? null : coordinator.getProgram().getTrainingDuration();
    }

    private Coordinator coordinator(Authentication authentication) {
        return coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
    }

    private ResponseEntity<?> noProfile() {
        return ResponseEntity.status(403).body("Coordinator profile not found.");
    }

    private ResponseEntity<?> bad(String message) {
        return ResponseEntity.badRequest().body(message);
    }
}
