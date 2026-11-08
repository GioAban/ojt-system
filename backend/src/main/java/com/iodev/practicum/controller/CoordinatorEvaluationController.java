package com.iodev.practicum.controller;

import com.iodev.practicum.dto.EvaluationDtos.FormUpdate;
import com.iodev.practicum.dto.EvaluationDtos.Review;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.DocumentRequirement;
import com.iodev.practicum.model.DocumentRequirementAttachment;
import com.iodev.practicum.model.Evaluation;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.DocumentRequirementAttachmentRepository;
import com.iodev.practicum.repository.DocumentRequirementRepository;
import com.iodev.practicum.repository.StudentRepository;
import com.iodev.practicum.service.EvaluationFormService;
import com.iodev.practicum.service.StudentProgressService;
import com.iodev.practicum.service.StudentWorkService;
import com.iodev.practicum.service.SubmissionFileAccess;
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

/**
 * Pagsusuri ng coordinator sa form ng evaluation: ang signed copy at ang mga score.
 * Sariling student at sariling evaluation lang, sa iisang semester. Naka-lock kapag Checked na.
 */
@RestController
@RequestMapping("/api/coordinator/evaluations/{requirementId}/students/{studentId}")
public class CoordinatorEvaluationController {

    @Autowired private CoordinatorRepository coordinatorRepository;
    @Autowired private DocumentRequirementRepository requirementRepository;
    @Autowired private DocumentRequirementAttachmentRepository attachmentRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private EvaluationFormService forms;
    @Autowired private SubmissionFileAccess files;

    private record Ctx(Coordinator coordinator, Student student, Evaluation evaluation, ResponseEntity<?> error) {}

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> get(@PathVariable Long requirementId, @PathVariable Long studentId, Authentication auth) {
        Ctx ctx = ctx(requirementId, studentId, auth);
        if (ctx.error() != null) return ctx.error();
        return ResponseEntity.ok(review(ctx, requirementId));
    }

    @PutMapping
    @Transactional
    public ResponseEntity<?> save(@PathVariable Long requirementId, @PathVariable Long studentId,
                                  @RequestBody FormUpdate body, Authentication auth) {
        Ctx ctx = ctx(requirementId, studentId, auth);
        if (ctx.error() != null) return ctx.error();
        if ("CHECKED".equals(status(studentId, requirementId))) {
            return ResponseEntity.status(409).body("This is already Checked. Change the status first to edit the scores.");
        }
        try {
            forms.save(ctx.evaluation(), ctx.student(), body);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
        Coordinator c = ctx.coordinator();
        forms.markEdited(ctx.evaluation(), ctx.student(), c.getUser() == null ? "Coordinator" : c.getUser().getFullname());
        return ResponseEntity.ok(review(ctx, requirementId));
    }

    private Review review(Ctx ctx, Long requirementId) {
        String status = status(ctx.student().getId(), requirementId);
        return new Review(forms.view(ctx.evaluation(), ctx.student(), !"CHECKED".equals(status)), status,
                files.list(ctx.student().getId(), StudentWorkService.REQUIREMENT, requirementId));
    }

    private String status(Long studentId, Long requirementId) {
        String status = "ASSIGNED";
        for (DocumentRequirementAttachment a : attachmentRepository.findByStudentIdAndDocumentRequirementId(studentId, requirementId)) {
            status = StudentProgressService.strongest(status, StudentProgressService.normalize(a.getStatus()));
        }
        return status;
    }

    private Ctx ctx(Long requirementId, Long studentId, Authentication auth) {
        Coordinator c = coordinatorRepository.findByUserEmail(auth.getName()).orElse(null);
        if (c == null) return fail(ResponseEntity.status(403).body("Coordinator profile not found."));

        DocumentRequirement r = requirementRepository.findById(requirementId).orElse(null);
        if (r == null || !EvaluationAccess.isBuiltIn(r)) return fail(ResponseEntity.status(404).body("Evaluation not found."));
        Student s = studentRepository.findById(studentId).orElse(null);
        if (s == null) return fail(ResponseEntity.status(404).body("Student not found."));
        if (!r.getCoordinator().getId().equals(c.getId()) || !s.getCoordinator().getId().equals(c.getId())) {
            return fail(ResponseEntity.status(403).body("You can only review your own students' evaluations."));
        }
        if (!s.getSemester().getId().equals(r.getSemester().getId())) {
            return fail(ResponseEntity.badRequest().body("That evaluation doesn't belong to the student's semester."));
        }
        Evaluation e = forms.evaluationFor(requirementId);
        if (e == null) return fail(ResponseEntity.status(503).body("This evaluation form isn't ready yet."));
        return new Ctx(c, s, e, null);
    }

    private static Ctx fail(ResponseEntity<?> error) {
        return new Ctx(null, null, null, error);
    }
}
