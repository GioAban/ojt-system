package com.iodev.practicum.controller;

import com.iodev.practicum.dto.ReportDtos.*;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.CoordinatorSavedReport;
import com.iodev.practicum.model.Semester;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.CoordinatorSavedReportRepository;
import com.iodev.practicum.repository.SemesterRepository;
import com.iodev.practicum.service.ReportSourceService;
import com.iodev.practicum.service.ReportWriteBackService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;

/**
 * Mga naka-save na report ng coordinator. Sarili lang ang nakikita at nababago: ang report ng iba
 * ay 404. Huling sulat ang nananaig ayon sa clientUpdatedAt. Hindi binabago ng mga ito ang datos ng system.
 */
@RestController
@RequestMapping("/api/coordinator/reports")
public class CoordinatorSavedReportController {

    private static final Set<String> TYPES = Set.of(
            "annual", "hte-report", "hte-list",
            "list-students", "list-per-hte", "list-deployment", "list-requirements", "list-dtr", "list-evaluation");
    private static final int MAX_CHARS = 5_000_000;
    private static final int MAX_TITLE = 200;
    private static final String COPY_PREFIX = "Copy of ";
    private static final int MAX_CHANGES = 500;

    @Autowired private CoordinatorRepository coordinatorRepository;
    @Autowired private SemesterRepository semesterRepository;
    @Autowired private CoordinatorSavedReportRepository reports;
    @Autowired private ReportSourceService sources;
    @Autowired private ReportWriteBackService writeBack;

    /** Datos ng system para makabuo ng bagong report */
    @GetMapping("/source")
    @Transactional(readOnly = true)
    public ResponseEntity<?> source(@RequestParam Long semesterId, Authentication auth) {
        Coordinator coordinator = current(auth);
        if (coordinator == null) return ResponseEntity.status(403).body("Coordinator profile not found.");
        Semester semester = semesterRepository.findById(semesterId).orElse(null);
        if (semester == null) return ResponseEntity.status(404).body("Semester not found.");
        return ResponseEntity.ok(sources.source(coordinator, semester));
    }

    @GetMapping("/saved")
    @Transactional(readOnly = true)
    public ResponseEntity<?> list(@RequestParam Long semesterId,
                                  @RequestParam(required = false) String type,
                                  @RequestParam(required = false) String q,
                                  Authentication auth) {
        Coordinator coordinator = current(auth);
        if (coordinator == null) return ResponseEntity.status(403).body("Coordinator profile not found.");
        String typeFilter = type == null ? "" : type.trim();
        String search = q == null ? "" : q.trim().toLowerCase();
        List<SavedSummary> rows = reports
                .findSummaries(coordinator.getId(), semesterId, typeFilter, search.isEmpty() ? "" : "%" + search + "%")
                .stream()
                .map(r -> new SavedSummary(r.getId(), r.getReportType(), r.getTitle(), r.getSemesterId(),
                        r.getClientUpdatedAt(), r.getLastEditedBy()))
                .toList();
        return ResponseEntity.ok(rows);
    }

    @PostMapping("/saved")
    @Transactional
    public ResponseEntity<?> create(@RequestBody CreateSavedRequest body, Authentication auth) {
        Coordinator coordinator = current(auth);
        if (coordinator == null) return ResponseEntity.status(403).body("Coordinator profile not found.");
        if (body == null || body.semesterId() == null || body.type() == null || !TYPES.contains(body.type())) {
            return ResponseEntity.badRequest().body("Please choose a report type and a semester.");
        }
        if (!semesterRepository.existsById(body.semesterId())) return ResponseEntity.status(404).body("Semester not found.");
        String problem = contentProblem(body.content());
        if (problem != null) return ResponseEntity.badRequest().body(problem);

        CoordinatorSavedReport r = new CoordinatorSavedReport();
        r.setCoordinatorId(coordinator.getId());
        r.setSemesterId(body.semesterId());
        r.setReportType(body.type());
        r.setTitle(cleanTitle(body.title()));
        r.setContent(body.content());
        r.setClientUpdatedAt(body.clientUpdatedAt() == null ? System.currentTimeMillis() : body.clientUpdatedAt());
        r.setLastEditedBy(editorName(coordinator));
        reports.save(r);
        return ResponseEntity.ok(summary(r));
    }

    @GetMapping("/saved/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<?> detail(@PathVariable Long id, Authentication auth) {
        Coordinator coordinator = current(auth);
        if (coordinator == null) return ResponseEntity.status(403).body("Coordinator profile not found.");
        CoordinatorSavedReport r = reports.findByIdAndCoordinatorId(id, coordinator.getId()).orElse(null);
        if (r == null) return notFound();
        Semester semester = semesterRepository.findById(r.getSemesterId()).orElse(null);
        if (semester == null) return ResponseEntity.status(404).body("Semester not found.");
        return ResponseEntity.ok(new SavedDetail(r.getId(), r.getReportType(), r.getTitle(), r.getSemesterId(),
                r.getContent(), r.getClientUpdatedAt(), r.getLastEditedBy(), sources.source(coordinator, semester)));
    }

    @PutMapping("/saved/{id}")
    @Transactional
    public ResponseEntity<?> save(@PathVariable Long id, @RequestBody UpdateSavedRequest body, Authentication auth) {
        Coordinator coordinator = current(auth);
        if (coordinator == null) return ResponseEntity.status(403).body("Coordinator profile not found.");
        if (body == null) return ResponseEntity.badRequest().body("Nothing to save.");
        String problem = contentProblem(body.content());
        if (problem != null) return ResponseEntity.badRequest().body(problem);
        CoordinatorSavedReport r = reports.findByIdAndCoordinatorId(id, coordinator.getId()).orElse(null);
        if (r == null) return notFound();

        long incoming = body.clientUpdatedAt() == null ? System.currentTimeMillis() : body.clientUpdatedAt();
        if (r.getClientUpdatedAt() != null && r.getClientUpdatedAt() > incoming) {
            // Mas bago ang nasa server (galing sa ibang device): ibalik ito, huwag patungan
            return ResponseEntity.ok(new SavedSaveResult(false, r.getTitle(), r.getContent(), r.getClientUpdatedAt()));
        }
        r.setTitle(cleanTitle(body.title()));
        r.setContent(body.content());
        r.setClientUpdatedAt(incoming);
        r.setLastEditedBy(editorName(coordinator));
        reports.save(r);
        return ResponseEntity.ok(new SavedSaveResult(true, r.getTitle(), r.getContent(), r.getClientUpdatedAt()));
    }

    @DeleteMapping("/saved/{id}")
    @Transactional
    public ResponseEntity<?> delete(@PathVariable Long id, Authentication auth) {
        Coordinator coordinator = current(auth);
        if (coordinator == null) return ResponseEntity.status(403).body("Coordinator profile not found.");
        CoordinatorSavedReport r = reports.findByIdAndCoordinatorId(id, coordinator.getId()).orElse(null);
        if (r == null) return notFound();
        reports.delete(r);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/saved/{id}/duplicate")
    @Transactional
    public ResponseEntity<?> duplicate(@PathVariable Long id, Authentication auth) {
        Coordinator coordinator = current(auth);
        if (coordinator == null) return ResponseEntity.status(403).body("Coordinator profile not found.");
        CoordinatorSavedReport from = reports.findByIdAndCoordinatorId(id, coordinator.getId()).orElse(null);
        if (from == null) return notFound();

        CoordinatorSavedReport copy = new CoordinatorSavedReport();
        copy.setCoordinatorId(coordinator.getId());
        copy.setSemesterId(from.getSemesterId());
        copy.setReportType(from.getReportType());
        copy.setTitle(cleanTitle(COPY_PREFIX + from.getTitle()));
        copy.setContent(from.getContent());
        copy.setClientUpdatedAt(System.currentTimeMillis());
        copy.setLastEditedBy(editorName(coordinator));
        reports.save(copy);
        return ResponseEntity.ok(summary(copy));
    }

    /** Listahan ng lumang halaga, bagong halaga at apektado. Walang isinusulat. */
    @PostMapping("/saved/{id}/apply/preview")
    @Transactional(readOnly = true)
    public ResponseEntity<?> applyPreview(@PathVariable Long id, @RequestBody ApplyRequest body, Authentication auth) {
        Coordinator coordinator = current(auth);
        if (coordinator == null) return ResponseEntity.status(403).body("Coordinator profile not found.");
        CoordinatorSavedReport r = reports.findByIdAndCoordinatorId(id, coordinator.getId()).orElse(null);
        if (r == null) return notFound();
        if (!validChanges(body)) return ResponseEntity.badRequest().body("There's nothing to apply.");
        return ResponseEntity.ok(writeBack.preview(coordinator, r, body.changes()));
    }

    /** Kinumpirma na: sinusuri ulit, saka isinusulat lahat o wala (409 kasama ang dahilan) */
    @PostMapping("/saved/{id}/apply")
    @Transactional
    public ResponseEntity<?> apply(@PathVariable Long id, @RequestBody ApplyRequest body, Authentication auth) {
        Coordinator coordinator = current(auth);
        if (coordinator == null) return ResponseEntity.status(403).body("Coordinator profile not found.");
        CoordinatorSavedReport r = reports.findByIdAndCoordinatorId(id, coordinator.getId()).orElse(null);
        if (r == null) return notFound();
        if (!validChanges(body)) return ResponseEntity.badRequest().body("There's nothing to apply.");
        ApplyPreview blocked = writeBack.apply(coordinator, r, body.changes());
        if (blocked != null) return ResponseEntity.status(409).body(blocked);
        Semester semester = semesterRepository.findById(r.getSemesterId()).orElse(null);
        if (semester == null) return ResponseEntity.status(404).body("Semester not found.");
        return ResponseEntity.ok(new ApplyResult(body.changes().size(), sources.source(coordinator, semester)));
    }

    // ---------------------------------------------------------------------

    private static boolean validChanges(ApplyRequest body) {
        return body != null && body.changes() != null && !body.changes().isEmpty() && body.changes().size() <= MAX_CHANGES;
    }

    private static SavedSummary summary(CoordinatorSavedReport r) {
        return new SavedSummary(r.getId(), r.getReportType(), r.getTitle(), r.getSemesterId(),
                r.getClientUpdatedAt(), r.getLastEditedBy());
    }

    private static ResponseEntity<String> notFound() {
        return ResponseEntity.status(404).body("Report not found.");
    }

    private static String contentProblem(String content) {
        if (content == null) return "Nothing to save.";
        return content.length() > MAX_CHARS ? "The report is too long." : null;
    }

    private static String cleanTitle(String raw) {
        String t = raw == null ? "" : raw.trim();
        if (t.isEmpty()) return "Untitled report";
        return t.length() > MAX_TITLE ? t.substring(0, MAX_TITLE) : t;
    }

    private static String editorName(Coordinator coordinator) {
        return coordinator.getUser() == null ? null : coordinator.getUser().getFullname();
    }

    private Coordinator current(Authentication auth) {
        if (auth == null) return null;
        return coordinatorRepository.findByUserEmail(auth.getName()).orElse(null);
    }
}
