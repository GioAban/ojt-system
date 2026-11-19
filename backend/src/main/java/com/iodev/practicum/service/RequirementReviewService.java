package com.iodev.practicum.service;

import com.iodev.practicum.model.DocumentRequirement;
import com.iodev.practicum.model.DocumentRequirementAttachment;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.DocumentRequirementAttachmentRepository;
import com.iodev.practicum.util.EvaluationAccess;
import com.iodev.practicum.util.SubmissionStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.util.List;

/**
 * Status ng requirement ng isang student. Iisang pagsulat para sa review screen at sa mga report.
 * Mula sa report: Submitted -> Evaluated o Invalid lang; nakakandado ang Evaluated (sa review screen ang pagwawasto).
 */
@Service
public class RequirementReviewService {

    @Autowired private DocumentRequirementAttachmentRepository attachmentRepository;

    /**
     * Isinusulat ang status. Kapag wala pang record at hindi Assigned, gumagawa ng record na walang file.
     * @return false kung walang record at Assigned (walang binago)
     */
    public boolean setStatus(Student student, DocumentRequirement requirement, String key, String stored, Timestamp now) {
        List<DocumentRequirementAttachment> rows = attachmentRepository
                .findByStudentIdAndDocumentRequirementId(student.getId(), requirement.getId());

        if (rows.isEmpty()) {
            if (key.equals("ASSIGNED")) return false;

            // Wala pang naipapasa: gumawa ng record na walang file para maitala ang status
            DocumentRequirementAttachment record = new DocumentRequirementAttachment();
            record.setDocumentRequirement(requirement);
            record.setStudent(student);
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
        return true;
    }

    /** Ang kasalukuyang status (ASSIGNED, FOR_CHECKING, CHECKED, INVALID), parehong tuntunin ng tracking */
    public String currentStatus(Student student, DocumentRequirement requirement) {
        String status = "ASSIGNED";
        for (DocumentRequirementAttachment a : attachmentRepository
                .findByStudentIdAndDocumentRequirementId(student.getId(), requirement.getId())) {
            status = StudentProgressService.strongest(status, StudentProgressService.normalize(a.getStatus()));
        }
        return status;
    }

    /** Pangalan sa mga report: Checked = Evaluated */
    public static String reportLabel(String key) {
        return switch (key) {
            case "CHECKED" -> "Evaluated";
            case "FOR_CHECKING" -> "Submitted";
            case "INVALID" -> "Invalid or returned";
            default -> "Missing";
        };
    }

    /** Mula sa report: Submitted -> Evaluated o Invalid lang */
    public PreparedChange checkFromReport(Student student, DocumentRequirement requirement, String rawKey) {
        if (EvaluationAccess.isBuiltIn(requirement)) {
            throw ActionException.bad("Use the evaluation status for the Midterm and Final Evaluation.");
        }
        String key = rawKey == null ? "" : rawKey.trim().toUpperCase();
        if (!key.equals("CHECKED") && !key.equals("INVALID")) {
            throw ActionException.bad("From a report, a requirement can only be marked Evaluated or Invalid.");
        }
        String current = currentStatus(student, requirement);
        String label = requirement.getTitle() == null ? "Requirement" : requirement.getTitle().trim();
        if (current.equals(key)) {
            return new PreparedChange(label, reportLabel(current), reportLabel(key), 1, null);
        }
        if (current.equals("CHECKED")) {
            throw ActionException.bad("This requirement is already Evaluated. Correct it on the review screen.");
        }
        if (!current.equals("FOR_CHECKING")) {
            throw ActionException.bad("Only a submitted requirement can be marked from a report.");
        }
        String stored = SubmissionStatus.stored(key);
        return new PreparedChange(label, reportLabel(current), reportLabel(key), 1,
                () -> setStatus(student, requirement, key, stored, new Timestamp(System.currentTimeMillis())));
    }
}
