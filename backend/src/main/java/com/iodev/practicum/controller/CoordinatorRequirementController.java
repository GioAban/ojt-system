package com.iodev.practicum.controller;

import com.iodev.practicum.dto.RequirementCreateRequest;
import com.iodev.practicum.dto.TrackingResponse;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.DocumentRequirement;
import com.iodev.practicum.model.Semester;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.DocumentRequirementRepository;
import com.iodev.practicum.repository.SemesterRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;

@RestController
@RequestMapping("/api/coordinator/requirements")
public class CoordinatorRequirementController {

    private static final List<String> TYPES = List.of("initial", "pre", "post");

    @Autowired
    private CoordinatorRepository coordinatorRepository;

    @Autowired
    private DocumentRequirementRepository documentRequirementRepository;

    @Autowired
    private SemesterRepository semesterRepository;

    @PostMapping
    @Transactional
    public ResponseEntity<?> create(@RequestBody RequirementCreateRequest request,
                                    Authentication authentication) {
        if (request == null) {
            return ResponseEntity.badRequest().body("Request body is required.");
        }

        String type = request.getType() == null ? "" : request.getType().trim().toLowerCase();
        if (!TYPES.contains(type)) {
            return ResponseEntity.badRequest().body("Type must be initial, pre, or post.");
        }
        if (request.getSemesterId() == null) {
            return ResponseEntity.badRequest().body("Please select a semester.");
        }

        String title = request.getTitle() == null ? "" : request.getTitle().trim().replaceAll("\\s+", " ");
        if (title.isEmpty()) {
            return ResponseEntity.badRequest().body("Title is required.");
        }
        if (title.length() > 255) {
            return ResponseEntity.badRequest().body("Title is too long (max 255 characters).");
        }

        String instructions = request.getInstructions() == null ? "" : request.getInstructions().trim();
        if (instructions.length() > 5000) {
            return ResponseEntity.badRequest().body("Instructions are too long (max 5000 characters).");
        }

        Timestamp dueDate = null;
        String rawDue = request.getDueDate() == null ? "" : request.getDueDate().trim();
        if (!rawDue.isEmpty()) {
            try {
                dueDate = Timestamp.valueOf(LocalDate.parse(rawDue).atTime(23, 59));
            } catch (DateTimeParseException e) {
                return ResponseEntity.badRequest().body("Due date must look like 2026-10-30.");
            }
        }

        Coordinator coordinator = coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
        if (coordinator == null) {
            return ResponseEntity.status(403).body("Coordinator profile not found.");
        }

        Semester semester = semesterRepository.findById(request.getSemesterId()).orElse(null);
        if (semester == null) {
            return ResponseEntity.badRequest().body("Selected semester was not found.");
        }
        if (Boolean.TRUE.equals(semester.getIsArchived())) {
            return ResponseEntity.badRequest().body("That semester is archived.");
        }

        if (documentRequirementRepository.titleExists(coordinator.getId(), semester.getId(), type, title)) {
            return ResponseEntity.status(409)
                    .body("You already have a requirement with that title in this tab.");
        }

        DocumentRequirement requirement = new DocumentRequirement();
        requirement.setCoordinator(coordinator);
        requirement.setSemester(semester);
        requirement.setType(type);
        requirement.setTitle(title);
        requirement.setInstructions(instructions.isEmpty() ? null : instructions);
        requirement.setDueDate(dueDate);
        requirement.setIsArchived(false);

        DocumentRequirement saved = documentRequirementRepository.save(requirement);

        return ResponseEntity.ok(
                new TrackingResponse.RequirementColumn(saved.getId(), saved.getTitle(), saved.getDueDate()));
    }
}