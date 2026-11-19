package com.iodev.practicum.service;

import com.iodev.practicum.model.DocumentRequirement;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.DocumentRequirementAttachmentRepository;
import com.iodev.practicum.repository.DocumentRequirementRepository;
import com.iodev.practicum.repository.SignedEvaluationRepository;
import com.iodev.practicum.repository.StudentRepository;
import com.iodev.practicum.repository.SubmissionFileRepository;
import com.iodev.practicum.util.EvaluationAccess;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;

/**
 * Pagbukas at pagsara ng Midterm o Final Evaluation ng student, kasama ang abiso kapag binuksan.
 * Iisa para sa bulk (Tracking, Requirements) at sa mga report.
 */
@Service
public class EvaluationAccessService {

    @Autowired private StudentRepository studentRepository;
    @Autowired private DocumentRequirementRepository requirementRepository;
    @Autowired private DocumentRequirementAttachmentRepository attachmentRepository;
    @Autowired private SignedEvaluationRepository signedEvaluations;
    @Autowired private SubmissionFileRepository submissionFiles;
    @Autowired private StudentNotifier studentNotifier;

    /** Dahilan para sa bulk tally; null kung pwede */
    public String skipReason(Student s, Long semesterId, String key, boolean open) {
        if (!semesterId.equals(s.getSemester().getId())) return "belong to a different semester";
        if (Boolean.TRUE.equals(s.getIsArchived())) return "are archived";
        if (EvaluationAccess.isOpen(s, key) == open) return open ? "were already open" : "were already closed";
        return null;
    }

    /** Binubuksan o isinasara; ini-save ang mga binago at nag-aabiso pagkatapos ma-commit kapag binuksan */
    public void apply(Long coordinatorId, Long semesterId, String key, boolean open, List<Student> changed) {
        for (Student s : changed) EvaluationAccess.setOpen(s, key, open);
        studentRepository.saveAll(changed);
        if (open) notifyOpened(coordinatorId, semesterId, key, changed);
    }

    /**
     * Para sa iisang student mula sa report. Dagdag na tuntunin: hindi ginagalaw ang evaluation na
     * turned in, Evaluated o Invalid, at hindi isinasara ang nasimulan na ng student.
     */
    public PreparedChange checkFromReport(Long coordinatorId, Student s, Long semesterId, String key, boolean open) {
        if (!EvaluationAccess.validKey(key)) throw ActionException.bad("Unknown evaluation.");
        String title = EvaluationAccess.titleOf(key);
        String old = EvaluationAccess.isOpen(s, key) ? "Assigned" : "Not assigned or not opened yet";
        String next = open ? "Assigned" : "Not assigned or not opened yet";

        if (!semesterId.equals(s.getSemester().getId())) {
            throw ActionException.bad("This student belongs to a different semester.");
        }
        if (Boolean.TRUE.equals(s.getIsArchived())) throw ActionException.bad("This student is archived.");
        if (EvaluationAccess.isOpen(s, key) == open) return new PreparedChange(title, old, next, 1, null);

        DocumentRequirement requirement = requirementRepository.findBuiltIn(coordinatorId, semesterId, key).orElse(null);
        if (requirement != null) {
            String status = "ASSIGNED";
            for (var a : attachmentRepository.findByStudentIdAndDocumentRequirementId(s.getId(), requirement.getId())) {
                status = StudentProgressService.strongest(status, StudentProgressService.normalize(a.getStatus()));
            }
            if (!"ASSIGNED".equals(status)) {
                throw ActionException.bad("This " + title + " was already turned in or evaluated. Change it on the review screen.");
            }
            if (!open && started(s.getId(), requirement.getId())) {
                throw ActionException.bad("The student already started this " + title + ", so it can't be closed from a report.");
            }
        }

        return new PreparedChange(title, old, next, 1,
                () -> apply(coordinatorId, semesterId, key, open, List.of(s)));
    }

    /** May naka-save na form, signed copy o upload ang student para sa evaluation */
    private boolean started(Long studentId, Long requirementId) {
        for (Object[] row : signedEvaluations.findForReports(List.of(requirementId))) {
            if (studentId.equals(row[0])) return true;
        }
        for (Object[] row : submissionFiles.uploadsFor(StudentWorkService.REQUIREMENT, List.of(requirementId))) {
            if (studentId.equals(row[0])) return true;
        }
        return false;
    }

    /** Pagkatapos ma-commit lang, at ang pagpalya ay hindi dapat makapigil sa pagbukas */
    private void notifyOpened(Long coordinatorId, Long semesterId, String key, List<Student> opened) {
        if (opened.isEmpty()) return;
        DocumentRequirement requirement = requirementRepository.findBuiltIn(coordinatorId, semesterId, key).orElse(null);
        if (requirement == null) return;

        List<Long> ids = opened.stream().map(Student::getId).toList();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                try {
                    studentNotifier.evaluationOpened(requirement, ids);
                } catch (RuntimeException e) {
                    org.slf4j.LoggerFactory.getLogger(EvaluationAccessService.class)
                            .warn("Couldn't save the evaluation notifications", e);
                }
            }
        });
    }
}
