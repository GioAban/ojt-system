package com.iodev.practicum.controller;

import com.iodev.practicum.model.Company;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.Department;
import com.iodev.practicum.model.DocumentRequirement;
import com.iodev.practicum.model.DocumentRequirementAttachment;
import com.iodev.practicum.model.MonthlyDtr;
import com.iodev.practicum.model.MonthlyWeeklyReport;
import com.iodev.practicum.model.SignedDtr;
import com.iodev.practicum.model.SignedWeeklyReport;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.model.StudentDepartmentHistory;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.DepartmentRepository;
import com.iodev.practicum.repository.DocumentRequirementAttachmentRepository;
import com.iodev.practicum.repository.DocumentRequirementRepository;
import com.iodev.practicum.repository.MonthlyDtrRepository;
import com.iodev.practicum.repository.MonthlyWeeklyReportRepository;
import com.iodev.practicum.repository.SignedDtrRepository;
import com.iodev.practicum.repository.SignedWeeklyReportRepository;
import com.iodev.practicum.repository.StudentDepartmentHistoryRepository;
import com.iodev.practicum.repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/coordinator/bulk")
public class BulkController {

    public record BulkResult(int updated, int skipped, List<String> reasons) {}
    public record BulkStatusRequest(List<Long> studentIds, List<Long> requirementIds, String status) {}
    public record BulkPlacementRequest(List<Long> studentIds, String status) {}
    public record BulkMoaRequest(List<Long> studentIds, String status) {}
    public record BulkDepartmentRequest(List<Long> studentIds, Long departmentId) {}
    public record BulkIdsRequest(List<Long> studentIds) {}
    public record BulkCompleteRequest(List<Long> studentIds, String completedDate) {}
    public record BulkRatingRequest(List<Long> studentIds, List<Long> reportIds, String rating) {}
    public record BulkHoursRequest(List<Long> studentIds, Long dtrId, BigDecimal hours) {}
    public record BulkStartDateRequest(List<Long> studentIds, String startDate) {}
    /** rating (weekly) at hours (DTR) ay opsyonal at para lang sa Checked: pinapalitan nito ang laman ng bawat cell */
    public record BulkItemsStatusRequest(
            List<Long> studentIds, List<Long> itemIds, String status, String rating, BigDecimal hours) {}

    private static final int MAX_STUDENTS = 1000;
    private static final BigDecimal MAX_HOURS = new BigDecimal("744");

    private static final Map<String, String> STORED_STATUS = Map.of(
            "ASSIGNED", "Assigned",
            "FOR_CHECKING", "For Checking",
            "CHECKED", "Checked",
            "INVALID", "Invalid");

    private static final Map<String, Integer> RATING_VALUES =
            Map.of("EXCELLENT", 4, "VERY_GOOD", 3, "GOOD", 2, "POOR", 1);

    @Autowired private CoordinatorRepository coordinatorRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private DocumentRequirementRepository requirementRepository;
    @Autowired private DocumentRequirementAttachmentRepository attachmentRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private StudentDepartmentHistoryRepository historyRepository;
    @Autowired private MonthlyWeeklyReportRepository weeklyRepository;
    @Autowired private SignedWeeklyReportRepository signedWeeklyRepository;
    @Autowired private MonthlyDtrRepository dtrRepository;
    @Autowired private SignedDtrRepository signedDtrRepository;

    // ---------------------------------------------------------------------
    // Mga helper
    // ---------------------------------------------------------------------

    private record Scope(Coordinator coordinator, List<Student> students, int foreign, ResponseEntity<?> error) {}

    private static class Tally {
        private int updated;
        private int skipped;
        private final Map<String, Integer> reasons = new LinkedHashMap<>();

        Tally(int foreign) {
            if (foreign > 0) skip("are not your students", foreign);
        }

        void ok() { updated++; }

        void skip(String reason) { skip(reason, 1); }

        void skip(String reason, int count) {
            skipped += count;
            reasons.merge(reason, count, Integer::sum);
        }

        BulkResult done() {
            List<String> list = reasons.entrySet().stream()
                    .map(e -> e.getValue() + " " + e.getKey())
                    .toList();
            return new BulkResult(updated, skipped, list);
        }
    }

    private Scope scope(List<Long> ids, Authentication authentication) {
        Coordinator coordinator = coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
        if (coordinator == null) {
            return new Scope(null, null, 0, ResponseEntity.status(403).body("Coordinator profile not found."));
        }
        if (ids == null || ids.isEmpty()) {
            return new Scope(null, null, 0, ResponseEntity.badRequest().body("Select at least one student."));
        }

        Set<Long> unique = new LinkedHashSet<>(ids);
        if (unique.size() > MAX_STUDENTS) {
            return new Scope(null, null, 0,
                    ResponseEntity.badRequest().body("You can update up to " + MAX_STUDENTS + " students at a time."));
        }

        List<Student> owned = studentRepository.findAllById(unique).stream()
                .filter(s -> s.getCoordinator().getId().equals(coordinator.getId()))
                .toList();
        if (owned.isEmpty()) {
            return new Scope(null, null, 0,
                    ResponseEntity.status(403).body("None of the selected students are yours."));
        }

        return new Scope(coordinator, owned, unique.size() - owned.size(), null);
    }

    private static String upper(String value) {
        return value == null ? "" : value.trim().toUpperCase();
    }

    private static LocalDate startOf(Student s) {
        String raw = s.getStartTrainingDate() != null && !s.getStartTrainingDate().isBlank()
                ? s.getStartTrainingDate()
                : s.getDeployedDate();
        if (raw == null || raw.length() < 10) return null;
        try {
            return LocalDate.parse(raw.substring(0, 10));
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private ResponseEntity<?> bad(String message) {
        return ResponseEntity.badRequest().body(message);
    }

    // ---------------------------------------------------------------------
    // Status ng requirements
    // ---------------------------------------------------------------------

    @PostMapping("/status")
    @Transactional
    public ResponseEntity<?> status(@RequestBody BulkStatusRequest request, Authentication authentication) {
        if (request == null) return bad("Request body is required.");

        String key = upper(request.status());
        String stored = STORED_STATUS.get(key);
        if (stored == null) return bad("Status must be ASSIGNED, FOR_CHECKING, CHECKED, or INVALID.");
        if (request.requirementIds() == null || request.requirementIds().isEmpty()) {
            return bad("Select at least one requirement.");
        }

        Scope scope = scope(request.studentIds(), authentication);
        if (scope.error() != null) return scope.error();

        Set<Long> requirementIds = new LinkedHashSet<>(request.requirementIds());
        List<DocumentRequirement> requirements = requirementRepository.findAllById(requirementIds);
        if (requirements.size() != requirementIds.size()) return ResponseEntity.notFound().build();
        for (DocumentRequirement r : requirements) {
            if (!r.getCoordinator().getId().equals(scope.coordinator().getId())) {
                return ResponseEntity.status(403).body("You can only update your own requirements.");
            }
        }

        Set<Long> studentIds = scope.students().stream().map(Student::getId).collect(Collectors.toSet());
        Map<String, List<DocumentRequirementAttachment>> existing = new HashMap<>();
        for (DocumentRequirementAttachment a : attachmentRepository.findForBulk(requirementIds, studentIds)) {
            existing.computeIfAbsent(a.getStudent().getId() + "-" + a.getDocumentRequirement().getId(),
                    k -> new ArrayList<>()).add(a);
        }

        List<DocumentRequirementAttachment> toSave = new ArrayList<>();
        Tally tally = new Tally(scope.foreign());

        for (Student s : scope.students()) {
            boolean applied = false;

            for (DocumentRequirement r : requirements) {
                if (!s.getSemester().getId().equals(r.getSemester().getId())) continue;
                applied = true;

                List<DocumentRequirementAttachment> rows =
                        existing.getOrDefault(s.getId() + "-" + r.getId(), List.of());

                if (rows.isEmpty()) {
                    if (key.equals("ASSIGNED")) continue;

                    // Wala pang naipapasa: gumawa ng record na walang file para maitala ang status
                    DocumentRequirementAttachment record = new DocumentRequirementAttachment();
                    record.setDocumentRequirement(r);
                    record.setStudent(s);
                    record.setFilePath(null);
                    record.setStatus(stored);
                    toSave.add(record);
                } else {
                    // Hindi binubura ang file o ang mga comment, status lang ang nagbabago
                    for (DocumentRequirementAttachment a : rows) {
                        a.setStatus(stored);
                        toSave.add(a);
                    }
                }
            }

            if (applied) tally.ok();
            else tally.skip("belong to a different semester");
        }

        attachmentRepository.saveAll(toSave);
        return ResponseEntity.ok(tally.done());
    }

    // ---------------------------------------------------------------------
    // MOA
    // ---------------------------------------------------------------------

    /** Status ng placement: For Approval o Approved lang. Ang Deployed ay sa pag-assign ng company. */
    @PostMapping("/placement-status")
    @Transactional
    public ResponseEntity<?> placementStatus(@RequestBody BulkPlacementRequest request, Authentication authentication) {
        if (request == null) return bad("Request body is required.");

        String key = upper(request.status());
        String stored = switch (key) {
            case "FOR_APPROVAL" -> "For Approval";
            case "APPROVED" -> "Approved";
            default -> null;
        };
        if (stored == null) {
            return bad("Use Assign company to deploy students. Status must be FOR_APPROVAL or APPROVED.");
        }

        Scope scope = scope(request.studentIds(), authentication);
        if (scope.error() != null) return scope.error();

        Tally tally = new Tally(scope.foreign());
        for (Student s : scope.students()) {
            if ("Completed".equalsIgnoreCase(s.getStatus())) {
                tally.skip("have completed the OJT");
            } else if (s.getDepartment() != null) {
                tally.skip("are placed in a company (remove them first)");
            } else {
                s.setStatus(stored);
                tally.ok();
            }
        }

        studentRepository.saveAll(scope.students());
        return ResponseEntity.ok(tally.done());
    }

    @PostMapping("/moa")
    @Transactional
    public ResponseEntity<?> moa(@RequestBody BulkMoaRequest request, Authentication authentication) {
        if (request == null) return bad("Request body is required.");

        String key = upper(request.status());
        String stored = key.equals("RELEASED") ? "Released" : key.equals("NOT_RELEASED") ? "Not Released" : null;
        if (stored == null) return bad("Status must be RELEASED or NOT_RELEASED.");

        Scope scope = scope(request.studentIds(), authentication);
        if (scope.error() != null) return scope.error();

        Tally tally = new Tally(scope.foreign());
        for (Student s : scope.students()) {
            s.setMoaStatus(stored);
            tally.ok();
        }

        studentRepository.saveAll(scope.students());
        return ResponseEntity.ok(tally.done());
    }

    // ---------------------------------------------------------------------
    // Company at department
    // ---------------------------------------------------------------------

    @PostMapping("/department")
    @Transactional
    public ResponseEntity<?> assignDepartment(@RequestBody BulkDepartmentRequest request,
                                              Authentication authentication) {
        if (request == null || request.departmentId() == null) return bad("Please select a department.");

        Scope scope = scope(request.studentIds(), authentication);
        if (scope.error() != null) return scope.error();

        Department department = departmentRepository.findById(request.departmentId()).orElse(null);
        if (department == null) return bad("Selected department was not found.");

        Company company = department.getCompany();
        if (!company.getCoordinator().getId().equals(scope.coordinator().getId())) {
            return ResponseEntity.status(403).body("That company doesn't belong to you.");
        }
        if (Boolean.TRUE.equals(company.getIsArchived()) || Boolean.TRUE.equals(department.getIsArchived())) {
            return bad("That company or department is archived.");
        }
        if (!"approved".equalsIgnoreCase(department.getStatus())) {
            return bad("That department isn't approved yet.");
        }

        Tally tally = new Tally(scope.foreign());

        List<Student> eligible = new ArrayList<>();
        for (Student s : scope.students()) {
            if (s.getSemester().getId().equals(company.getSemester().getId())) eligible.add(s);
            else tally.skip("belong to a different semester");
        }

        long needPlace = eligible.stream()
                .filter(s -> s.getDepartment() == null
                        || !s.getDepartment().getId().equals(department.getId()))
                .count();

        long filled = 0;
        for (Object[] row : studentRepository.countByDepartmentIds(List.of(department.getId()))) {
            filled = (Long) row[1];
        }
        int slots = department.getSlots() == null ? 0 : department.getSlots();
        long left = Math.max(0, slots - filled);

        if (needPlace > left) {
            return ResponseEntity.status(409).body("Not enough slots: " + left + " left in this department, but "
                    + needPlace + " student(s) need a place. Nothing was changed.");
        }

        Timestamp now = new Timestamp(System.currentTimeMillis());

        for (Student s : eligible) {
            Department current = s.getDepartment();
            if (current != null && current.getId().equals(department.getId())) {
                tally.ok(); // nandoon na
                continue;
            }

            boolean hadPrevious = current != null || historyRepository.countByStudentId(s.getId()) > 0;

            List<StudentDepartmentHistory> open = historyRepository.findByStudentIdAndEndedAtIsNull(s.getId());
            for (StudentDepartmentHistory entry : open) {
                entry.setEndedAt(now);
            }
            historyRepository.saveAll(open);

            StudentDepartmentHistory created = new StudentDepartmentHistory();
            created.setStudent(s);
            created.setDepartment(department);
            created.setType(hadPrevious ? "transferred" : "initial");
            created.setStartedAt(now);
            historyRepository.save(created);

            s.setDepartment(department);
            // Ang may company ay Deployed na (maliban sa Completed)
            if (!"Completed".equalsIgnoreCase(s.getStatus())) s.setStatus("Deployed");
            tally.ok();
        }

        studentRepository.saveAll(eligible);
        return ResponseEntity.ok(tally.done());
    }

    @PostMapping("/department/remove")
    @Transactional
    public ResponseEntity<?> removeDepartment(@RequestBody BulkIdsRequest request, Authentication authentication) {
        if (request == null) return bad("Request body is required.");

        Scope scope = scope(request.studentIds(), authentication);
        if (scope.error() != null) return scope.error();

        Timestamp now = new Timestamp(System.currentTimeMillis());
        Tally tally = new Tally(scope.foreign());

        for (Student s : scope.students()) {
            if (s.getDepartment() == null) {
                tally.skip("have no company yet");
                continue;
            }

            List<StudentDepartmentHistory> open = historyRepository.findByStudentIdAndEndedAtIsNull(s.getId());
            for (StudentDepartmentHistory entry : open) {
                entry.setEndedAt(now);
            }
            historyRepository.saveAll(open);

            s.setDepartment(null);
            // Wala nang company: bumalik sa Approved
            if ("Deployed".equalsIgnoreCase(s.getStatus())) s.setStatus("Approved");
            tally.ok();
        }

        studentRepository.saveAll(scope.students());
        return ResponseEntity.ok(tally.done());
    }

    // ---------------------------------------------------------------------
    // Complete OJT at revert
    // ---------------------------------------------------------------------

    @PostMapping("/complete")
    @Transactional
    public ResponseEntity<?> complete(@RequestBody BulkCompleteRequest request, Authentication authentication) {
        String raw = request == null || request.completedDate() == null ? "" : request.completedDate().trim();
        if (raw.isEmpty()) return bad("Please enter the completion date.");

        LocalDate completed;
        try {
            completed = LocalDate.parse(raw);
        } catch (DateTimeParseException e) {
            return bad("Date must look like 2026-04-30.");
        }
        if (completed.isAfter(LocalDate.now())) return bad("The completion date can't be in the future.");
        if (completed.getYear() < 2000) return bad("Please enter a valid completion date.");

        Scope scope = scope(request.studentIds(), authentication);
        if (scope.error() != null) return scope.error();

        Timestamp end = Timestamp.valueOf(completed.atStartOfDay());
        Tally tally = new Tally(scope.foreign());

        for (Student s : scope.students()) {
            if (s.getDepartment() == null) {
                tally.skip("have no company yet");
                continue;
            }

            LocalDate start = startOf(s);
            if (start != null && completed.isBefore(start)) {
                tally.skip("started after that date");
                continue;
            }

            s.setStatus("Completed");
            s.setCompletedDate(completed.toString());

            for (StudentDepartmentHistory entry : historyRepository.findByStudentIdAndEndedAtIsNull(s.getId())) {
                entry.setEndedAt(entry.getStartedAt() != null && end.before(entry.getStartedAt())
                        ? entry.getStartedAt()
                        : end);
                historyRepository.save(entry);
            }
            tally.ok();
        }

        studentRepository.saveAll(scope.students());
        return ResponseEntity.ok(tally.done());
    }

    @PostMapping("/revert")
    @Transactional
    public ResponseEntity<?> revert(@RequestBody BulkIdsRequest request, Authentication authentication) {
        if (request == null) return bad("Request body is required.");

        Scope scope = scope(request.studentIds(), authentication);
        if (scope.error() != null) return scope.error();

        Tally tally = new Tally(scope.foreign());

        for (Student s : scope.students()) {
            if (!"Completed".equalsIgnoreCase(s.getStatus())) {
                tally.skip("are not completed");
                continue;
            }

            s.setStatus("Deployed");
            s.setCompletedDate(null);
            s.setHiredDate(null);
            s.setJobRelatedToCourse(null);
            s.setEmployabilityLevel(null);

            // Buksan ulit ang placement na isinara ng pag-complete
            Department department = s.getDepartment();
            if (department != null && historyRepository.findByStudentIdAndEndedAtIsNull(s.getId()).isEmpty()) {
                historyRepository
                        .findFirstByStudentIdAndDepartmentIdOrderByIdDesc(s.getId(), department.getId())
                        .ifPresent(entry -> {
                            entry.setEndedAt(null);
                            historyRepository.save(entry);
                        });
            }
            tally.ok();
        }

        studentRepository.saveAll(scope.students());
        return ResponseEntity.ok(tally.done());
    }

    // ---------------------------------------------------------------------
    // Weekly report evaluation
    // ---------------------------------------------------------------------

    @PostMapping("/weekly-rating")
    @Transactional
    public ResponseEntity<?> weeklyRating(@RequestBody BulkRatingRequest request, Authentication authentication) {
        if (request == null) return bad("Request body is required.");

        String key = upper(request.rating());
        boolean clear = key.equals("NONE");
        Integer value = RATING_VALUES.get(key);
        if (!clear && value == null) return bad("Rating must be EXCELLENT, VERY_GOOD, GOOD, POOR, or NONE.");
        if (request.reportIds() == null || request.reportIds().isEmpty()) return bad("Select at least one week.");

        Scope scope = scope(request.studentIds(), authentication);
        if (scope.error() != null) return scope.error();

        Set<Long> reportIds = new LinkedHashSet<>(request.reportIds());
        List<MonthlyWeeklyReport> reports = weeklyRepository.findAllById(reportIds);
        if (reports.size() != reportIds.size()) return ResponseEntity.notFound().build();
        for (MonthlyWeeklyReport r : reports) {
            if (!r.getCoordinator().getId().equals(scope.coordinator().getId())) {
                return ResponseEntity.status(403).body("You can only update your own weekly reports.");
            }
        }

        Set<Long> studentIds = scope.students().stream().map(Student::getId).collect(Collectors.toSet());
        Map<String, SignedWeeklyReport> existing = new HashMap<>();
        for (SignedWeeklyReport r : signedWeeklyRepository.findForBulk(reportIds, studentIds)) {
            existing.put(r.getStudent().getId() + "-" + r.getMonthlyWeeklyReport().getId(), r); // ang pinakabago
        }

        List<SignedWeeklyReport> toSave = new ArrayList<>();
        Tally tally = new Tally(scope.foreign());

        for (Student s : scope.students()) {
            boolean applied = false;

            for (MonthlyWeeklyReport report : reports) {
                if (!s.getSemester().getId().equals(report.getSemester().getId())) continue;
                applied = true;

                SignedWeeklyReport record = existing.get(s.getId() + "-" + report.getId());

                if (clear) {
                    if (record != null) {
                        record.setSupervisorEvaluation(null);
                        record.setStatus(record.getFilePath() != null ? "For Checking" : "Assigned");
                        toSave.add(record);
                    }
                    continue;
                }

                if (record == null) {
                    record = new SignedWeeklyReport();
                    record.setMonthlyWeeklyReport(report);
                    record.setStudent(s);
                }
                record.setSupervisorEvaluation(value);
                record.setStatus("Checked");
                toSave.add(record);
            }

            if (applied) tally.ok();
            else tally.skip("belong to a different semester");
        }

        signedWeeklyRepository.saveAll(toSave);
        return ResponseEntity.ok(tally.done());
    }

    // ---------------------------------------------------------------------
    // Status ng weekly reports at DTR (bulk approve, invalid, at iba pa)
    // ---------------------------------------------------------------------

    @PostMapping("/weekly-status")
    @Transactional
    public ResponseEntity<?> weeklyStatus(@RequestBody BulkItemsStatusRequest request, Authentication authentication) {
        if (request == null) return bad("Request body is required.");

        String key = upper(request.status());
        String stored = STORED_STATUS.get(key);
        if (stored == null) return bad("Status must be ASSIGNED, FOR_CHECKING, CHECKED, or INVALID.");
        if (request.itemIds() == null || request.itemIds().isEmpty()) return bad("Select at least one week.");

        String ratingKey = upper(request.rating());
        Integer ratingValue = ratingKey.isEmpty() ? null : RATING_VALUES.get(ratingKey);
        if (!ratingKey.isEmpty() && ratingValue == null) {
            return bad("Rating must be EXCELLENT, VERY_GOOD, GOOD, or POOR.");
        }
        if (ratingValue != null && !key.equals("CHECKED")) {
            return bad("An evaluation can only be given together with Checked.");
        }

        Scope scope = scope(request.studentIds(), authentication);
        if (scope.error() != null) return scope.error();

        Set<Long> reportIds = new LinkedHashSet<>(request.itemIds());
        List<MonthlyWeeklyReport> reports = weeklyRepository.findAllById(reportIds);
        if (reports.size() != reportIds.size()) return ResponseEntity.notFound().build();
        for (MonthlyWeeklyReport r : reports) {
            if (!r.getCoordinator().getId().equals(scope.coordinator().getId())) {
                return ResponseEntity.status(403).body("You can only update your own weekly reports.");
            }
        }

        Set<Long> studentIds = scope.students().stream().map(Student::getId).collect(Collectors.toSet());
        Map<String, SignedWeeklyReport> existing = new HashMap<>();
        for (SignedWeeklyReport r : signedWeeklyRepository.findForBulk(reportIds, studentIds)) {
            existing.put(r.getStudent().getId() + "-" + r.getMonthlyWeeklyReport().getId(), r); // ang pinakabago
        }

        Timestamp now = new Timestamp(System.currentTimeMillis());
        List<SignedWeeklyReport> toSave = new ArrayList<>();
        Tally tally = new Tally(scope.foreign());

        for (Student s : scope.students()) {
            for (MonthlyWeeklyReport report : reports) {
                if (!s.getSemester().getId().equals(report.getSemester().getId())) {
                    tally.skip("belong to a different semester");
                    continue;
                }

                SignedWeeklyReport record = existing.get(s.getId() + "-" + report.getId());
                if (record == null) {
                    if (key.equals("ASSIGNED")) { // wala namang babaguhin
                        tally.ok();
                        continue;
                    }
                    if (key.equals("CHECKED") && ratingValue == null) {
                        tally.skip("have no evaluation yet");
                        continue;
                    }
                    record = new SignedWeeklyReport();
                    record.setMonthlyWeeklyReport(report);
                    record.setStudent(s);
                    record.setCreatedAt(now);
                } else if (key.equals("CHECKED") && ratingValue == null && record.getSupervisorEvaluation() == null) {
                    tally.skip("have no evaluation yet");
                    continue;
                }

                // Ang evaluation ay para lang sa Checked: ang ibang status ay nag-aalis nito
                if (ratingValue != null) record.setSupervisorEvaluation(ratingValue);
                else if (!key.equals("CHECKED")) record.setSupervisorEvaluation(null);

                record.setStatus(stored);
                record.setUpdatedAt(now);
                toSave.add(record);
                tally.ok();
            }
        }

        signedWeeklyRepository.saveAll(toSave);
        return ResponseEntity.ok(tally.done());
    }

    /** Ang Checked ay nangangailangan ng hours; ang walang hours ay nilalaktawan. Ina-update ang rendered hours. */
    @PostMapping("/dtr-status")
    @Transactional
    public ResponseEntity<?> dtrStatus(@RequestBody BulkItemsStatusRequest request, Authentication authentication) {
        if (request == null) return bad("Request body is required.");

        String key = upper(request.status());
        String stored = STORED_STATUS.get(key);
        if (stored == null) return bad("Status must be ASSIGNED, FOR_CHECKING, CHECKED, or INVALID.");
        if (request.itemIds() == null || request.itemIds().isEmpty()) return bad("Select at least one month.");

        BigDecimal override = request.hours() == null ? null : request.hours().setScale(2, RoundingMode.HALF_UP);
        if (override != null) {
            if (!key.equals("CHECKED")) return bad("Hours can only be set together with Checked.");
            if (override.signum() < 0 || override.compareTo(MAX_HOURS) > 0) {
                return bad("Hours must be between 0 and 744.");
            }
        }

        Scope scope = scope(request.studentIds(), authentication);
        if (scope.error() != null) return scope.error();

        Set<Long> dtrIds = new LinkedHashSet<>(request.itemIds());
        List<MonthlyDtr> dtrs = dtrRepository.findAllById(dtrIds);
        if (dtrs.size() != dtrIds.size()) return ResponseEntity.notFound().build();
        for (MonthlyDtr d : dtrs) {
            if (!d.getCoordinator().getId().equals(scope.coordinator().getId())) {
                return ResponseEntity.status(403).body("You can only update your own DTRs.");
            }
        }

        Set<Long> studentIds = scope.students().stream().map(Student::getId).collect(Collectors.toSet());
        Map<String, SignedDtr> existing = new HashMap<>();
        for (SignedDtr r : signedDtrRepository.findForBulkMany(dtrIds, studentIds)) {
            existing.put(r.getStudent().getId() + "-" + r.getMonthlyDtr().getId(), r); // ang pinakabago
        }

        Timestamp now = new Timestamp(System.currentTimeMillis());
        List<SignedDtr> toSave = new ArrayList<>();
        Set<Long> touched = new LinkedHashSet<>();
        Tally tally = new Tally(scope.foreign());

        for (Student s : scope.students()) {
            for (MonthlyDtr dtr : dtrs) {
                if (!s.getSemester().getId().equals(dtr.getSemester().getId())) {
                    tally.skip("belong to a different semester");
                    continue;
                }

                SignedDtr record = existing.get(s.getId() + "-" + dtr.getId());
                if (record == null) {
                    if (key.equals("ASSIGNED")) {
                        tally.ok();
                        continue;
                    }
                    if (key.equals("CHECKED") && override == null) {
                        tally.skip("have no hours yet");
                        continue;
                    }
                    record = new SignedDtr();
                    record.setMonthlyDtr(dtr);
                    record.setStudent(s);
                    record.setCreatedAt(now);
                } else if (key.equals("CHECKED") && record.getHours() == null && override == null) {
                    tally.skip("have no hours yet");
                    continue;
                }

                if (override != null) record.setHours(override);
                record.setStatus(stored);
                record.setUpdatedAt(now);
                toSave.add(record);
                touched.add(s.getId());
                tally.ok();
            }
        }

        signedDtrRepository.saveAll(toSave);

        // Ang rendered hours ay ang kabuuan ng mga Checked na DTR
        for (Student s : scope.students()) {
            if (!touched.contains(s.getId())) continue;
            BigDecimal total = signedDtrRepository.totalHours(s.getId());
            s.setRenderedHours((total == null ? BigDecimal.ZERO : total).setScale(2, RoundingMode.HALF_UP));
        }
        studentRepository.saveAll(scope.students());

        return ResponseEntity.ok(tally.done());
    }

    // ---------------------------------------------------------------------
    // DTR hours at start date
    // ---------------------------------------------------------------------

    @PostMapping("/dtr-hours")
    @Transactional
    public ResponseEntity<?> dtrHours(@RequestBody BulkHoursRequest request, Authentication authentication) {
        if (request == null || request.dtrId() == null) return bad("Please select a month.");

        BigDecimal hours = request.hours() == null ? null : request.hours().setScale(2, RoundingMode.HALF_UP);
        if (hours != null && (hours.signum() < 0 || hours.compareTo(MAX_HOURS) > 0)) {
            return bad("Hours must be between 0 and 744.");
        }

        Scope scope = scope(request.studentIds(), authentication);
        if (scope.error() != null) return scope.error();

        MonthlyDtr dtr = dtrRepository.findById(request.dtrId()).orElse(null);
        if (dtr == null) return ResponseEntity.notFound().build();
        if (!dtr.getCoordinator().getId().equals(scope.coordinator().getId())) {
            return ResponseEntity.status(403).body("You can only update your own DTRs.");
        }

        Set<Long> studentIds = scope.students().stream().map(Student::getId).collect(Collectors.toSet());
        Map<Long, SignedDtr> existing = new HashMap<>();
        for (SignedDtr r : signedDtrRepository.findForBulk(dtr.getId(), studentIds)) {
            existing.put(r.getStudent().getId(), r); // ang pinakabago
        }

        Tally tally = new Tally(scope.foreign());

        for (Student s : scope.students()) {
            if (!s.getSemester().getId().equals(dtr.getSemester().getId())) {
                tally.skip("belong to a different semester");
                continue;
            }

            SignedDtr record = existing.get(s.getId());

            if (hours == null) {
                if (record != null) {
                    record.setHours(null);
                    record.setStatus(record.getFilePath() != null ? "For Checking" : "Assigned");
                    signedDtrRepository.save(record);
                }
            } else {
                if (record == null) {
                    record = new SignedDtr();
                    record.setMonthlyDtr(dtr);
                    record.setStudent(s);
                }
                record.setHours(hours);
                record.setStatus("Checked");
                signedDtrRepository.save(record);
            }

            BigDecimal total = signedDtrRepository.totalHours(s.getId());
            s.setRenderedHours((total == null ? BigDecimal.ZERO : total).setScale(2, RoundingMode.HALF_UP));
            tally.ok();
        }

        studentRepository.saveAll(scope.students());
        return ResponseEntity.ok(tally.done());
    }

    @PostMapping("/start-date")
    @Transactional
    public ResponseEntity<?> startDate(@RequestBody BulkStartDateRequest request, Authentication authentication) {
        if (request == null) return bad("Request body is required.");

        String raw = request.startDate() == null ? "" : request.startDate().trim();
        String stored = null;

        if (!raw.isEmpty()) {
            try {
                LocalDate date = LocalDate.parse(raw);
                if (date.getYear() < 2000 || date.getYear() > 2100) {
                    return bad("Please enter a year between 2000 and 2100.");
                }
                stored = date.toString();
            } catch (DateTimeParseException e) {
                return bad("Date must look like 2026-02-10.");
            }
        }

        Scope scope = scope(request.studentIds(), authentication);
        if (scope.error() != null) return scope.error();

        Tally tally = new Tally(scope.foreign());
        for (Student s : scope.students()) {
            s.setStartTrainingDate(stored);
            tally.ok();
        }

        studentRepository.saveAll(scope.students());
        return ResponseEntity.ok(tally.done());
    }
}