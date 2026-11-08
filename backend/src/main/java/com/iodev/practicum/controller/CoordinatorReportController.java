package com.iodev.practicum.controller;

import com.iodev.practicum.dto.ReportDtos.*;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.CoordinatorReportDraft;
import com.iodev.practicum.model.CoordinatorReportSignatories;
import com.iodev.practicum.model.Semester;
import com.iodev.practicum.repository.CoordinatorReportDraftRepository;
import com.iodev.practicum.repository.CoordinatorReportSignatoriesRepository;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.SemesterRepository;
import com.iodev.practicum.service.ReportSourceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Set;

/**
 * Mga report ng coordinator: konteksto (letterhead, pirmahan), datos ng system para sa semester,
 * at ang draft na isine-save sa server (huling sulat ang nananaig ayon sa clientUpdatedAt).
 * Laging ang coordinator na naka-login (galing sa token) at ang kaniyang mga student lang.
 * Hindi binabago ng pag-edit ng report ang mismong datos ng system.
 */
@RestController
@RequestMapping("/api/coordinator/reports")
public class CoordinatorReportController {

    private static final Set<String> TYPES = Set.of("annual", "hte-report", "hte-list", "lists");
    private static final int MAX_CHARS = 1_000_000;
    private static final int MAX_SIGNATORY_CHARS = 5_000;

    @Autowired private CoordinatorRepository coordinatorRepository;
    @Autowired private SemesterRepository semesterRepository;
    @Autowired private CoordinatorReportDraftRepository drafts;
    @Autowired private CoordinatorReportSignatoriesRepository signatories;
    @Autowired private ReportSourceService sources;

    /** Ang mga binago ng coordinator sa pirmahan (JSON), o null. Nauuna sa /{type} para hindi ito masalo. */
    @GetMapping("/signatories")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getSignatories(Authentication auth) {
        Coordinator coordinator = current(auth);
        if (coordinator == null) return ResponseEntity.status(403).body("Coordinator profile not found.");
        String saved = signatories.findByCoordinatorId(coordinator.getId())
                .map(CoordinatorReportSignatories::getContent).orElse(null);
        return ResponseEntity.ok(new SignatoriesRequest(saved));
    }

    @PutMapping("/signatories")
    @Transactional
    public ResponseEntity<?> saveSignatories(@RequestBody SignatoriesRequest body, Authentication auth) {
        Coordinator coordinator = current(auth);
        if (coordinator == null) return ResponseEntity.status(403).body("Coordinator profile not found.");
        if (body == null) return ResponseEntity.badRequest().body("Nothing to save.");
        String content = body.content() == null || body.content().isBlank() ? null : body.content();
        if (content != null && content.length() > MAX_SIGNATORY_CHARS) {
            return ResponseEntity.badRequest().body("The names are too long.");
        }
        CoordinatorReportSignatories s = signatories.findByCoordinatorId(coordinator.getId()).orElse(null);
        if (s == null) {
            s = new CoordinatorReportSignatories();
            s.setCoordinatorId(coordinator.getId());
        }
        s.setContent(content);
        signatories.save(s);
        return ResponseEntity.ok(new SignatoriesRequest(content));
    }

    @GetMapping("/{type}")
    @Transactional(readOnly = true)
    public ResponseEntity<?> detail(@PathVariable String type, @RequestParam Long semesterId, Authentication auth) {
        if (!TYPES.contains(type)) return ResponseEntity.status(404).body("Unknown report.");
        Coordinator coordinator = current(auth);
        if (coordinator == null) return ResponseEntity.status(403).body("Coordinator profile not found.");
        Semester semester = semesterRepository.findById(semesterId).orElse(null);
        if (semester == null) return ResponseEntity.status(404).body("Semester not found.");

        CoordinatorReportDraft d = drafts
                .findByCoordinatorIdAndSemesterIdAndReportType(coordinator.getId(), semesterId, type).orElse(null);
        return ResponseEntity.ok(new Detail(
                sources.context(coordinator, semester),
                sources.data(coordinator, semesterId),
                d == null ? null : new DraftData(d.getContent(), d.getClientUpdatedAt())));
    }

    @PutMapping("/{type}")
    @Transactional
    public ResponseEntity<?> save(@PathVariable String type, @RequestParam Long semesterId,
                                  @RequestBody SaveRequest body, Authentication auth) {
        if (!TYPES.contains(type)) return ResponseEntity.status(404).body("Unknown report.");
        Coordinator coordinator = current(auth);
        if (coordinator == null) return ResponseEntity.status(403).body("Coordinator profile not found.");
        if (!semesterRepository.existsById(semesterId)) return ResponseEntity.status(404).body("Semester not found.");
        if (body == null || body.content() == null) return ResponseEntity.badRequest().body("Nothing to save.");
        if (body.content().length() > MAX_CHARS) return ResponseEntity.badRequest().body("The report is too long.");

        long incoming = body.clientUpdatedAt() == null ? System.currentTimeMillis() : body.clientUpdatedAt();
        CoordinatorReportDraft d = drafts
                .findByCoordinatorIdAndSemesterIdAndReportType(coordinator.getId(), semesterId, type).orElse(null);
        if (d != null && d.getClientUpdatedAt() != null && d.getClientUpdatedAt() > incoming) {
            // Mas bago ang nasa server (galing sa ibang device): ibalik ito, huwag patungan
            return ResponseEntity.ok(new SaveResult(false, new DraftData(d.getContent(), d.getClientUpdatedAt())));
        }
        if (d == null) {
            d = new CoordinatorReportDraft();
            d.setCoordinatorId(coordinator.getId());
            d.setSemesterId(semesterId);
            d.setReportType(type);
        }
        d.setContent(body.content());
        d.setClientUpdatedAt(incoming);
        drafts.save(d);
        return ResponseEntity.ok(new SaveResult(true, new DraftData(d.getContent(), d.getClientUpdatedAt())));
    }

    private Coordinator current(Authentication auth) {
        if (auth == null) return null;
        return coordinatorRepository.findByUserEmail(auth.getName()).orElse(null);
    }
}
