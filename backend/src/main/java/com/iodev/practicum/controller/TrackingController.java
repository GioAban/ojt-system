package com.iodev.practicum.controller;

import com.iodev.practicum.dto.TrackingResponse;
import com.iodev.practicum.dto.TrackingStatusRequest;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.CoordinatorType;
import com.iodev.practicum.model.Department;
import com.iodev.practicum.model.DocumentRequirement;
import com.iodev.practicum.model.DocumentRequirementAttachment;
import com.iodev.practicum.model.MessageFileType;
import com.iodev.practicum.model.MessageSenderType;
import com.iodev.practicum.model.PrivateDocumentMessage;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.DocumentRequirementAttachmentRepository;
import com.iodev.practicum.repository.DocumentRequirementRepository;
import com.iodev.practicum.repository.PrivateDocumentMessageRepository;
import com.iodev.practicum.repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import com.iodev.practicum.util.EmploymentValues;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/coordinator/tracking")
public class TrackingController {

    private static final List<String> TYPES = List.of("initial", "pre", "post");

    private static final Map<String, String> STORED_STATUS = Map.of(
        "ASSIGNED", "Assigned",
        "CHECKED", "Checked",
        "FOR_CHECKING", "For Checking",
        "INVALID", "Invalid");

    @Autowired
    private CoordinatorRepository coordinatorRepository;

    @Autowired
    private DocumentRequirementRepository documentRequirementRepository;

    @Autowired
    private DocumentRequirementAttachmentRepository attachmentRepository;

    @Autowired
    private PrivateDocumentMessageRepository messageRepository;

    @Autowired
    private StudentRepository studentRepository;

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> getTracking(@RequestParam Long semesterId,
                                         @RequestParam String type,
                                         Authentication authentication) {
        String normalizedType = type == null ? "" : type.trim().toLowerCase();
        if (!TYPES.contains(normalizedType)) {
            return ResponseEntity.badRequest().body("Type must be initial, pre, or post.");
        }

        Coordinator coordinator = coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
        if (coordinator == null) {
            return ResponseEntity.status(403).body("Coordinator profile not found.");
        }

        List<DocumentRequirement> requirements =
                documentRequirementRepository.findForTracking(coordinator.getId(), semesterId, normalizedType);
        List<Student> students = studentRepository.findForTracking(coordinator.getId(), semesterId);

        // "studentId-requirementId" -> pinakamahalagang status
        Map<String, String> statusByKey = new HashMap<>();
        if (!requirements.isEmpty() && !students.isEmpty()) {
            List<Long> requirementIds = requirements.stream().map(DocumentRequirement::getId).toList();
            for (Object[] row : attachmentRepository.findStatuses(requirementIds)) {
                String key = row[0] + "-" + row[1];
                statusByKey.merge(key, normalize((String) row[2]), TrackingController::strongest);
            }
        }

        List<TrackingResponse.RequirementColumn> columns = requirements.stream()
                .map(r -> new TrackingResponse.RequirementColumn(r.getId(), r.getTitle(), r.getDueDate()))
                .toList();

        List<TrackingResponse.StudentRow> rows = new ArrayList<>();
        for (Student s : students) {
            Map<Long, String> statuses = new LinkedHashMap<>();
            for (DocumentRequirement r : requirements) {
                statuses.put(r.getId(), statusByKey.getOrDefault(s.getId() + "-" + r.getId(), "ASSIGNED"));
            }

        Department d = s.getDepartment();
        rows.add(new TrackingResponse.StudentRow(
                s.getId(), s.getStudentNumber(), s.getFirstname(), s.getLastname(),
                s.getMiddleInitial(), s.getSubjectCode(), s.getMoaStatus(),
                d != null ? d.getCompany().getName() : null,
                d != null ? d.getName() : null,
                s.getStatus(), s.getCompletedDate(),
                s.getHiredDate() == null ? null : s.getHiredDate().toString(),
                EmploymentValues.jobKey(s.getJobRelatedToCourse()),
                EmploymentValues.levelKey(s.getEmployabilityLevel()),
                EmploymentValues.levelKey(s.getPredictedEmployabilityLevel()),
                s.getPredictionConfidence(),
                s.getPredictedAt(),
                statuses));
        }

        return ResponseEntity.ok(new TrackingResponse(semesterId, normalizedType, columns, rows));
    }

    @PatchMapping("/status")
    @Transactional
    public ResponseEntity<?> updateStatus(@RequestBody TrackingStatusRequest request,
                                        Authentication authentication) {
        if (request == null || request.getStudentId() == null || request.getRequirementId() == null) {
            return ResponseEntity.badRequest().body("Student and requirement are required.");
        }

        String statusKey = request.getStatus() == null ? "" : request.getStatus().trim().toUpperCase();
        String stored = STORED_STATUS.get(statusKey);
        if (stored == null) {
            return ResponseEntity.badRequest()
                    .body("Status must be ASSIGNED, FOR_CHECKING, CHECKED, or INVALID.");
        }

        Coordinator coordinator = coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
        if (coordinator == null) {
            return ResponseEntity.status(403).body("Coordinator profile not found.");
        }

        Student student = studentRepository.findById(request.getStudentId()).orElse(null);
        DocumentRequirement requirement = documentRequirementRepository.findById(request.getRequirementId()).orElse(null);
        if (student == null || requirement == null) {
            return ResponseEntity.notFound().build();
        }

        boolean ownsStudent = student.getCoordinator().getId().equals(coordinator.getId());
        boolean ownsRequirement = requirement.getCoordinator().getId().equals(coordinator.getId());
        if (!ownsStudent || !ownsRequirement) {
            return ResponseEntity.status(403).body("You can only update your own students' requirements.");
        }
        if (!student.getSemester().getId().equals(requirement.getSemester().getId())) {
            return ResponseEntity.badRequest().body("That requirement doesn't belong to the student's semester.");
        }

        List<DocumentRequirementAttachment> rows = attachmentRepository
                .findByStudentIdAndDocumentRequirementId(student.getId(), requirement.getId());

        if (rows.isEmpty()) {
            // Walang record at ibabalik lang sa Assigned: walang babaguhin
            if (statusKey.equals("ASSIGNED")) {
                return ResponseEntity.ok(Map.of("status", statusKey));
            }

            // Wala pang naipapasa ang student: gumawa ng record na walang file para maitala ang status
            DocumentRequirementAttachment record = new DocumentRequirementAttachment();
            record.setDocumentRequirement(requirement);
            record.setStudent(student);
            record.setFilePath(null);
            record.setStatus(stored);
            attachmentRepository.save(record);
        } else {
            // Hindi binubura ang file o ang mga comment, status lang ang nagbabago
            for (DocumentRequirementAttachment a : rows) {
                a.setStatus(stored);
            }
            attachmentRepository.saveAll(rows);
        }

        return ResponseEntity.ok(Map.of("status", statusKey));
    }

    private static String normalize(String raw) {
        if (raw == null) return "ASSIGNED";
        return switch (raw.trim().toLowerCase().replace('_', ' ')) {
            case "checked" -> "CHECKED";
            case "for checking" -> "FOR_CHECKING";
            case "invalid" -> "INVALID";
            default -> "ASSIGNED"; // wala pang naipapasa
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