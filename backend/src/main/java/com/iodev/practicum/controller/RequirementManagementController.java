package com.iodev.practicum.controller;

import com.iodev.practicum.dto.RequirementManagementDtos.*;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.DocumentRequirement;
import com.iodev.practicum.model.MonthlyDtr;
import com.iodev.practicum.model.MonthlyWeeklyReport;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.DocumentRequirementAttachmentRepository;
import com.iodev.practicum.repository.DocumentRequirementRepository;
import com.iodev.practicum.repository.MonthlyDtrRepository;
import com.iodev.practicum.repository.MonthlyWeeklyReportRepository;
import com.iodev.practicum.repository.SignedDtrRepository;
import com.iodev.practicum.repository.SignedWeeklyReportRepository;
import com.iodev.practicum.repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/coordinator/requirements")
public class RequirementManagementController {

    private static final List<String> TYPES = List.of("initial", "pre", "post");

    private static final List<String> MONTHS = List.of(
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December");

    @Autowired
    private CoordinatorRepository coordinatorRepository;

    @Autowired
    private DocumentRequirementRepository requirementRepository;

    @Autowired
    private DocumentRequirementAttachmentRepository attachmentRepository;

    @Autowired
    private MonthlyWeeklyReportRepository weeklyRepository;

    @Autowired
    private SignedWeeklyReportRepository signedWeeklyRepository;

    @Autowired
    private MonthlyDtrRepository dtrRepository;

    @Autowired
    private SignedDtrRepository signedDtrRepository;

    @Autowired
    private StudentRepository studentRepository;

    // =====================================================================
    // DOCUMENT REQUIREMENTS (initial / pre / post)
    // =====================================================================

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> documents(@RequestParam Long semesterId,
                                       @RequestParam String type,
                                       @RequestParam(defaultValue = "false") boolean archived,
                                       Authentication authentication) {
        String normalized = type == null ? "" : type.trim().toLowerCase();
        if (!TYPES.contains(normalized)) {
            return ResponseEntity.badRequest().body("Type must be initial, pre, or post.");
        }

        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        List<DocumentRequirement> items =
                requirementRepository.findForManagement(coordinator.getId(), semesterId, normalized, archived);
        Map<Long, Stats> stats = documentStats(items, studentIds(coordinator, semesterId));

        return ResponseEntity.ok(items.stream().map(r -> toItem(r, stats.get(r.getId()))).toList());
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<?> updateDocument(@PathVariable Long id,
                                            @RequestBody DocumentUpdateRequest request,
                                            Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        DocumentRequirement r = requirementRepository.findById(id).orElse(null);
        if (r == null) return ResponseEntity.notFound().build();
        if (!r.getCoordinator().getId().equals(coordinator.getId())) return notOwner();
        if (request == null) return ResponseEntity.badRequest().body("Request body is required.");

        String title = clean(request.title());
        if (title.isEmpty()) return ResponseEntity.badRequest().body("Title is required.");
        if (title.length() > 255) return ResponseEntity.badRequest().body("Title is too long (max 255 characters).");

        String instructions = request.instructions() == null ? "" : request.instructions().trim();
        if (instructions.length() > 5000) {
            return ResponseEntity.badRequest().body("Instructions are too long (max 5000 characters).");
        }

        Timestamp due;
        try {
            due = parseDue(request.dueDate());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }

        if (requirementRepository.titleExistsExcluding(
                coordinator.getId(), r.getSemester().getId(), r.getType(), title, id)) {
            return ResponseEntity.status(409).body("You already have a requirement with that title in this tab.");
        }

        r.setTitle(title);
        r.setInstructions(instructions.isEmpty() ? null : instructions);
        r.setDueDate(due);
        DocumentRequirement saved = requirementRepository.save(r);

        Map<Long, Stats> stats = documentStats(List.of(saved), studentIds(coordinator, saved.getSemester().getId()));
        return ResponseEntity.ok(toItem(saved, stats.get(saved.getId())));
    }

    @PatchMapping("/{id}/archive")
    @Transactional
    public ResponseEntity<?> archiveDocument(@PathVariable Long id, Authentication authentication) {
        return setDocumentArchived(id, true, authentication);
    }

    @PatchMapping("/{id}/restore")
    @Transactional
    public ResponseEntity<?> restoreDocument(@PathVariable Long id, Authentication authentication) {
        return setDocumentArchived(id, false, authentication);
    }

    private ResponseEntity<?> setDocumentArchived(Long id, boolean archived, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        DocumentRequirement r = requirementRepository.findById(id).orElse(null);
        if (r == null) return ResponseEntity.notFound().build();
        if (!r.getCoordinator().getId().equals(coordinator.getId())) return notOwner();

        if (!archived && requirementRepository.titleExistsExcluding(
                coordinator.getId(), r.getSemester().getId(), r.getType(), r.getTitle(), id)) {
            return ResponseEntity.status(409)
                    .body("An active requirement with that title already exists. Rename one of them first.");
        }

        r.setIsArchived(archived);
        requirementRepository.save(r);
        return ResponseEntity.ok().build();
    }

    // =====================================================================
    // WEEKLY REPORT PERIODS
    // =====================================================================

    @GetMapping("/weekly")
    @Transactional(readOnly = true)
    public ResponseEntity<?> weekly(@RequestParam Long semesterId,
                                    @RequestParam(defaultValue = "false") boolean archived,
                                    Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        List<MonthlyWeeklyReport> items = weeklyRepository.findForManagement(coordinator.getId(), semesterId, archived);
        Map<Long, Stats> stats = weeklyStats(items, studentIds(coordinator, semesterId));

        return ResponseEntity.ok(items.stream().map(r -> toItem(r, stats.get(r.getId()))).toList());
    }

    @PutMapping("/weekly/{id}")
    @Transactional
    public ResponseEntity<?> updateWeekly(@PathVariable Long id,
                                          @RequestBody WeeklyUpdateRequest request,
                                          Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        MonthlyWeeklyReport r = weeklyRepository.findById(id).orElse(null);
        if (r == null) return ResponseEntity.notFound().build();
        if (!r.getCoordinator().getId().equals(coordinator.getId())) return notOwner();
        if (request == null) return ResponseEntity.badRequest().body("Request body is required.");

        LocalDate from;
        LocalDate to;
        Timestamp due;
        try {
            from = LocalDate.parse(request.dateFrom());
            to = LocalDate.parse(request.dateTo());
            due = parseDue(request.dueDate());
        } catch (DateTimeParseException | NullPointerException e) {
            return ResponseEntity.badRequest().body("Please enter valid dates.");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }

        if (to.isBefore(from)) {
            return ResponseEntity.badRequest().body("The end date can't be before the start date.");
        }
        if (ChronoUnit.DAYS.between(from, to) > 31) {
            return ResponseEntity.badRequest().body("A weekly report period can't be longer than 31 days.");
        }

        java.sql.Date sqlFrom = java.sql.Date.valueOf(from);
        java.sql.Date sqlTo = java.sql.Date.valueOf(to);

        if (weeklyRepository.periodExistsExcluding(
                coordinator.getId(), r.getSemester().getId(), sqlFrom, sqlTo, id)) {
            return ResponseEntity.status(409).body("That week already exists.");
        }

        r.setMonthFrom(sqlFrom);
        r.setMonthTo(sqlTo);
        r.setDueDate(due);
        MonthlyWeeklyReport saved = weeklyRepository.save(r);

        Map<Long, Stats> stats = weeklyStats(List.of(saved), studentIds(coordinator, saved.getSemester().getId()));
        return ResponseEntity.ok(toItem(saved, stats.get(saved.getId())));
    }

    @PatchMapping("/weekly/{id}/archive")
    @Transactional
    public ResponseEntity<?> archiveWeekly(@PathVariable Long id, Authentication authentication) {
        return setWeeklyArchived(id, true, authentication);
    }

    @PatchMapping("/weekly/{id}/restore")
    @Transactional
    public ResponseEntity<?> restoreWeekly(@PathVariable Long id, Authentication authentication) {
        return setWeeklyArchived(id, false, authentication);
    }

    private ResponseEntity<?> setWeeklyArchived(Long id, boolean archived, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        MonthlyWeeklyReport r = weeklyRepository.findById(id).orElse(null);
        if (r == null) return ResponseEntity.notFound().build();
        if (!r.getCoordinator().getId().equals(coordinator.getId())) return notOwner();

        if (!archived && weeklyRepository.periodExistsExcluding(
                coordinator.getId(), r.getSemester().getId(), r.getMonthFrom(), r.getMonthTo(), id)) {
            return ResponseEntity.status(409).body("An active week with the same dates already exists.");
        }

        r.setIsArchived(archived);
        weeklyRepository.save(r);
        return ResponseEntity.ok().build();
    }

    // =====================================================================
    // DTR MONTHS
    // =====================================================================

    @GetMapping("/dtr")
    @Transactional(readOnly = true)
    public ResponseEntity<?> dtr(@RequestParam Long semesterId,
                                 @RequestParam(defaultValue = "false") boolean archived,
                                 Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        List<MonthlyDtr> items = archived
                ? dtrRepository.findArchivedForManagement(coordinator.getId(), semesterId)
                : dtrRepository.findForTracking(coordinator.getId(), semesterId);
        Map<Long, Stats> stats = dtrStats(items, studentIds(coordinator, semesterId));

        return ResponseEntity.ok(items.stream().map(d -> toItem(d, stats.get(d.getId()))).toList());
    }

    @PutMapping("/dtr/{id}")
    @Transactional
    public ResponseEntity<?> updateDtr(@PathVariable Long id,
                                       @RequestBody DtrUpdateRequest request,
                                       Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        MonthlyDtr d = dtrRepository.findById(id).orElse(null);
        if (d == null) return ResponseEntity.notFound().build();
        if (!d.getCoordinator().getId().equals(coordinator.getId())) return notOwner();
        if (request == null) return ResponseEntity.badRequest().body("Request body is required.");

        String raw = request.month() == null ? "" : request.month().trim();
        String month = MONTHS.stream().filter(m -> m.equalsIgnoreCase(raw)).findFirst().orElse(null);
        if (month == null) return ResponseEntity.badRequest().body("Please select a valid month.");

        Timestamp due;
        try {
            due = parseDue(request.dueDate());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }

        if (dtrRepository.monthExistsExcluding(coordinator.getId(), d.getSemester().getId(), month, id)) {
            return ResponseEntity.status(409).body(month + " already exists.");
        }

        d.setMonth(month);
        d.setDueDate(due);
        MonthlyDtr saved = dtrRepository.save(d);

        Map<Long, Stats> stats = dtrStats(List.of(saved), studentIds(coordinator, saved.getSemester().getId()));
        return ResponseEntity.ok(toItem(saved, stats.get(saved.getId())));
    }

    @PatchMapping("/dtr/{id}/archive")
    @Transactional
    public ResponseEntity<?> archiveDtr(@PathVariable Long id, Authentication authentication) {
        return setDtrArchived(id, true, authentication);
    }

    @PatchMapping("/dtr/{id}/restore")
    @Transactional
    public ResponseEntity<?> restoreDtr(@PathVariable Long id, Authentication authentication) {
        return setDtrArchived(id, false, authentication);
    }

    private ResponseEntity<?> setDtrArchived(Long id, boolean archived, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        MonthlyDtr d = dtrRepository.findById(id).orElse(null);
        if (d == null) return ResponseEntity.notFound().build();
        if (!d.getCoordinator().getId().equals(coordinator.getId())) return notOwner();

        if (!archived && dtrRepository.monthExistsExcluding(
                coordinator.getId(), d.getSemester().getId(), d.getMonth(), id)) {
            return ResponseEntity.status(409).body("An active " + d.getMonth() + " already exists.");
        }

        d.setIsArchived(archived ? 1 : 0);
        dtrRepository.save(d);
        return ResponseEntity.ok().build();
    }

    // =====================================================================
    // Stats
    // =====================================================================

    private Set<Long> studentIds(Coordinator coordinator, Long semesterId) {
        return studentRepository.findForTracking(coordinator.getId(), semesterId).stream()
                .map(Student::getId)
                .collect(Collectors.toSet());
    }

    private Map<Long, Stats> documentStats(List<DocumentRequirement> items, Set<Long> studentIds) {
        Map<Long, Stats> result = new HashMap<>();
        if (items.isEmpty()) return result;

        List<Long> ids = items.stream().map(DocumentRequirement::getId).toList();

        // Pinakamahalagang status ng bawat student sa bawat requirement (kapareho ng Tracking)
        Map<Long, Map<Long, String>> best = new HashMap<>();
        for (Object[] row : attachmentRepository.findStatuses(ids)) {
            Long studentId = (Long) row[0];
            Long requirementId = (Long) row[1];
            if (!studentIds.contains(studentId)) continue;
            best.computeIfAbsent(requirementId, k -> new HashMap<>())
                    .merge(studentId, normalize((String) row[2]), RequirementManagementController::strongest);
        }

        for (DocumentRequirement r : items) {
            long checked = 0;
            long forChecking = 0;
            long invalid = 0;
            for (String status : best.getOrDefault(r.getId(), Map.of()).values()) {
                switch (status) {
                    case "CHECKED" -> checked++;
                    case "FOR_CHECKING" -> forChecking++;
                    case "INVALID" -> invalid++;
                    default -> { }
                }
            }
            result.put(r.getId(), new Stats(studentIds.size(), checked, forChecking, invalid));
        }
        return result;
    }

    private Map<Long, Stats> weeklyStats(List<MonthlyWeeklyReport> items, Set<Long> studentIds) {
        Map<Long, Stats> result = new HashMap<>();
        if (items.isEmpty()) return result;

        List<Long> ids = items.stream().map(MonthlyWeeklyReport::getId).toList();
        Map<Long, Set<Long>> rated = new HashMap<>();
        for (Object[] row : signedWeeklyRepository.findRatings(ids)) {
            if (row[2] != null && studentIds.contains((Long) row[0])) {
                rated.computeIfAbsent((Long) row[1], k -> new HashSet<>()).add((Long) row[0]);
            }
        }

        for (MonthlyWeeklyReport r : items) {
            result.put(r.getId(), new Stats(studentIds.size(), rated.getOrDefault(r.getId(), Set.of()).size(), 0, 0));
        }
        return result;
    }

    private Map<Long, Stats> dtrStats(List<MonthlyDtr> items, Set<Long> studentIds) {
        Map<Long, Stats> result = new HashMap<>();
        if (items.isEmpty()) return result;

        List<Long> ids = items.stream().map(MonthlyDtr::getId).toList();
        Map<Long, Set<Long>> recorded = new HashMap<>();
        for (Object[] row : signedDtrRepository.findHours(ids)) {
            if (row[2] != null && studentIds.contains((Long) row[0])) {
                recorded.computeIfAbsent((Long) row[1], k -> new HashSet<>()).add((Long) row[0]);
            }
        }

        for (MonthlyDtr d : items) {
            result.put(d.getId(), new Stats(studentIds.size(), recorded.getOrDefault(d.getId(), Set.of()).size(), 0, 0));
        }
        return result;
    }

    // =====================================================================
    // Mga helper
    // =====================================================================

    private DocumentItem toItem(DocumentRequirement r, Stats stats) {
        return new DocumentItem(r.getId(), r.getTitle(), r.getInstructions(), r.getDueDate(),
                r.getCreatedAt(), Boolean.TRUE.equals(r.getIsArchived()), stats);
    }

    private WeeklyItem toItem(MonthlyWeeklyReport r, Stats stats) {
        return new WeeklyItem(r.getId(), r.getMonthFrom().toLocalDate(), r.getMonthTo().toLocalDate(),
                r.getDueDate(), r.getCreatedAt(), Boolean.TRUE.equals(r.getIsArchived()), stats);
    }

    private DtrItem toItem(MonthlyDtr d, Stats stats) {
        String flag = String.valueOf(d.getIsArchived());
        boolean archived = !(flag.equals("0") || flag.equals("null") || flag.equals("false"));
        return new DtrItem(d.getId(), d.getMonth(), d.getDueDate(), d.getCreatedAt(), archived, stats);
    }

    private Coordinator current(Authentication authentication) {
        return coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
    }

    private ResponseEntity<?> noProfile() {
        return ResponseEntity.status(403).body("Coordinator profile not found.");
    }

    private ResponseEntity<?> notOwner() {
        return ResponseEntity.status(403).body("You can only manage your own requirements.");
    }

    private String clean(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    private Timestamp parseDue(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return Timestamp.valueOf(LocalDate.parse(raw.trim()).atTime(23, 59));
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Due date must look like 2026-10-30.");
        }
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
}