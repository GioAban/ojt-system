package com.iodev.practicum.controller;

import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.model.StudentDepartmentHistory;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.StudentDepartmentHistoryRepository;
import com.iodev.practicum.repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.util.List;
import java.util.Map;

/**
 * Status ng student sa placement: For Approval, Approved, Deployed (Completed ay hiwalay na proseso).
 * - For Approval: makikita lang ng student ang mga company.
 * - Approved: puwede nang mag-apply o mag-request ng company at department.
 * - Deployed: tinanggap ang application, o ang coordinator mismo ang nag-assign ng company.
 */
@RestController
@RequestMapping("/api/coordinator/placement")
public class PlacementStatusController {

    private static final Map<String, String> STORED = Map.of(
            "FOR_APPROVAL", "For Approval",
            "APPROVED", "Approved",
            "DEPLOYED", "Deployed");

    public record StatusRequest(Long studentId, String status, Boolean removePlacement) {}
    public record StatusResult(String status, boolean placementRemoved) {}

    @Autowired private CoordinatorRepository coordinatorRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private StudentDepartmentHistoryRepository historyRepository;

    @PatchMapping("/status")
    @Transactional
    public ResponseEntity<?> update(@RequestBody StatusRequest request, Authentication authentication) {
        if (request == null || request.studentId() == null) return bad("Student is required.");

        String stored = STORED.get(upper(request.status()));
        if (stored == null) return bad("Status must be FOR_APPROVAL, APPROVED, or DEPLOYED.");

        Coordinator coordinator = coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
        if (coordinator == null) return ResponseEntity.status(403).body("Coordinator profile not found.");

        Student student = studentRepository.findById(request.studentId()).orElse(null);
        if (student == null) return ResponseEntity.status(404).body("Student not found.");
        if (!student.getCoordinator().getId().equals(coordinator.getId())) {
            return ResponseEntity.status(403).body("You can only update your own students.");
        }
        if ("Completed".equalsIgnoreCase(student.getStatus())) {
            return ResponseEntity.status(409).body("This student has completed the OJT. Revert to Deployed first.");
        }

        boolean removed = false;
        if (stored.equals("Deployed")) {
            if (student.getDepartment() == null) {
                return bad("Assign a company to this student before marking them as Deployed.");
            }
        } else if (student.getDepartment() != null) {
            if (!Boolean.TRUE.equals(request.removePlacement())) {
                return ResponseEntity.status(409)
                        .body("This student is placed in a company. Setting this status removes the placement.");
            }
            endPlacement(student);
            removed = true;
        }

        student.setStatus(stored);
        studentRepository.save(student);
        return ResponseEntity.ok(new StatusResult(stored, removed));
    }

    private void endPlacement(Student student) {
        Timestamp now = new Timestamp(System.currentTimeMillis());
        List<StudentDepartmentHistory> open = historyRepository.findByStudentIdAndEndedAtIsNull(student.getId());
        for (StudentDepartmentHistory entry : open) entry.setEndedAt(now);
        historyRepository.saveAll(open);
        student.setDepartment(null);
    }

    private static String upper(String value) {
        return value == null ? "" : value.trim().toUpperCase().replace(' ', '_');
    }

    private ResponseEntity<?> bad(String message) {
        return ResponseEntity.badRequest().body(message);
    }
}
