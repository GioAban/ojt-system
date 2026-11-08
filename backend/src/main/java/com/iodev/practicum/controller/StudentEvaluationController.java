package com.iodev.practicum.controller;

import com.iodev.practicum.dto.EvaluationDtos.FormUpdate;
import com.iodev.practicum.model.Evaluation;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.StudentManagementRepository;
import com.iodev.practicum.service.EvaluationFormService;
import com.iodev.practicum.service.StudentWorkService;
import com.iodev.practicum.service.StudentWorkService.Row;
import com.iodev.practicum.util.EvaluationAccess;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Comparator;

/**
 * Ang form ng evaluation para sa student. Dumadaan sa sariling listahan ng gawain niya (work.find),
 * kaya hindi niya maaabot ang sa iba, at ang open/closed ang nagpapasya kung mababasa o mababago ito.
 */
@RestController
@RequestMapping("/api/student/evaluations/{requirementId}")
public class StudentEvaluationController {

    @Autowired private StudentManagementRepository studentManagementRepository;
    @Autowired private StudentWorkService work;
    @Autowired private EvaluationFormService forms;

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> get(@PathVariable Long requirementId, Authentication auth) {
        Student s = current(auth);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");
        Row row = row(s, requirementId);
        if (row == null) return ResponseEntity.status(404).body("Not found.");
        if (row.locked()) return ResponseEntity.status(409).body(EvaluationAccess.CLOSED_MESSAGE);

        Evaluation evaluation = forms.evaluationFor(requirementId);
        if (evaluation == null) return notReady();
        return ResponseEntity.ok(forms.view(evaluation, s, editable(row)));
    }

    @PutMapping
    @Transactional
    public ResponseEntity<?> save(@PathVariable Long requirementId, @RequestBody FormUpdate body, Authentication auth) {
        Student s = current(auth);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");
        Row row = row(s, requirementId);
        if (row == null) return ResponseEntity.status(404).body("Not found.");
        if (row.closed()) return ResponseEntity.status(409).body(EvaluationAccess.CLOSED_MESSAGE);
        if ("CHECKED".equals(row.statusKey())) {
            return ResponseEntity.status(409).body("This was already checked by your coordinator, so it can't be changed.");
        }
        if ("FOR_CHECKING".equals(row.statusKey())) {
            return ResponseEntity.status(409).body("Unsubmit first if you want to change your work.");
        }

        Evaluation evaluation = forms.evaluationFor(requirementId);
        if (evaluation == null) return notReady();
        try {
            forms.save(evaluation, s, body);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
        return ResponseEntity.ok(forms.view(evaluation, s, true));
    }

    private Row row(Student s, Long requirementId) {
        Row row = work.find(s, StudentWorkService.REQUIREMENT, requirementId);
        return row == null || row.systemKey() == null ? null : row;
    }

    private static boolean editable(Row row) {
        return !row.closed() && ("ASSIGNED".equals(row.statusKey()) || "INVALID".equals(row.statusKey()));
    }

    private static ResponseEntity<?> notReady() {
        return ResponseEntity.status(503).body("This evaluation form isn't ready yet. Please try again later.");
    }

    private Student current(Authentication authentication) {
        if (authentication == null) return null;
        return studentManagementRepository.findByEmail(authentication.getName()).stream()
                .max(Comparator.comparing(Student::getId))
                .orElse(null);
    }
}
