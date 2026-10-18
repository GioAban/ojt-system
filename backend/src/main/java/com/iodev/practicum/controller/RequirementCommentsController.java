package com.iodev.practicum.controller;

import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.CoordinatorType;
import com.iodev.practicum.model.DocumentRequirement;
import com.iodev.practicum.model.DocumentRequirementAttachment;
import com.iodev.practicum.model.MessageFileType;
import com.iodev.practicum.model.MessageSenderType;
import com.iodev.practicum.model.PrivateDocumentMessage;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.model.StudentNotification;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.DocumentRequirementAttachmentRepository;
import com.iodev.practicum.repository.DocumentRequirementRepository;
import com.iodev.practicum.repository.PrivateDocumentMessageRepository;
import com.iodev.practicum.repository.StudentNotificationFeed;
import com.iodev.practicum.repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/coordinator/requirements/{requirementId}/submissions/{studentId}/comments")
public class RequirementCommentsController {

    public record CommentDto(
            Long id, String senderType, String senderName, String message,
            Timestamp createdAt, boolean mine) {}

    public record CommentRequest(String message) {}

    private record Ctx(Coordinator coordinator, DocumentRequirement requirement, Student student,
                       ResponseEntity<?> error) {}

    @Autowired
    private CoordinatorRepository coordinatorRepository;

    @Autowired
    private DocumentRequirementRepository requirementRepository;

    @Autowired
    private DocumentRequirementAttachmentRepository attachmentRepository;

    @Autowired
    private PrivateDocumentMessageRepository messageRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private StudentNotificationFeed notifications;

    private Ctx context(Long requirementId, Long studentId, Authentication authentication) {
        Coordinator coordinator = coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
        if (coordinator == null) {
            return new Ctx(null, null, null, ResponseEntity.status(403).body("Coordinator profile not found."));
        }

        DocumentRequirement requirement = requirementRepository.findById(requirementId).orElse(null);
        Student student = studentRepository.findById(studentId).orElse(null);
        if (requirement == null || student == null) {
            return new Ctx(null, null, null, ResponseEntity.notFound().build());
        }

        boolean ownsRequirement = requirement.getCoordinator().getId().equals(coordinator.getId());
        boolean ownsStudent = student.getCoordinator().getId().equals(coordinator.getId());
        if (!ownsRequirement || !ownsStudent) {
            return new Ctx(null, null, null,
                    ResponseEntity.status(403).body("You can only comment on your own students' work."));
        }
        if (!student.getSemester().getId().equals(requirement.getSemester().getId())) {
            return new Ctx(null, null, null,
                    ResponseEntity.badRequest().body("That requirement doesn't belong to the student's semester."));
        }

        return new Ctx(coordinator, requirement, student, null);
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> list(@PathVariable Long requirementId,
                                  @PathVariable Long studentId,
                                  Authentication authentication) {
        Ctx c = context(requirementId, studentId, authentication);
        if (c.error() != null) return c.error();

        List<Long> attachmentIds = attachmentRepository
                .findByStudentIdAndDocumentRequirementId(studentId, requirementId).stream()
                .map(DocumentRequirementAttachment::getId)
                .toList();
        if (attachmentIds.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        List<PrivateDocumentMessage> messages = messageRepository
                .findByFileTypeAndFileIdInOrderByCreatedAtAscIdAsc(
                        MessageFileType.DOCUMENT_REQUIREMENT_ATTACHMENT, attachmentIds);

        Set<Long> coordinatorIds = new HashSet<>();
        Set<Long> studentIds = new HashSet<>();
        for (PrivateDocumentMessage m : messages) {
            if (m.getSenderType() == MessageSenderType.STUDENT) studentIds.add(m.getSenderId());
            else coordinatorIds.add(m.getSenderId());
        }

        Map<Long, String> coordinatorNames = new HashMap<>();
        coordinatorRepository.findAllById(coordinatorIds)
                .forEach(co -> coordinatorNames.put(co.getId(), co.getUser().getFullname()));

        Map<Long, String> studentNames = new HashMap<>();
        studentRepository.findAllById(studentIds)
                .forEach(s -> studentNames.put(s.getId(), s.getFirstname() + " " + s.getLastname()));

        List<CommentDto> result = messages.stream().map(m -> {
            boolean fromStudent = m.getSenderType() == MessageSenderType.STUDENT;
            String name = (fromStudent ? studentNames : coordinatorNames).getOrDefault(m.getSenderId(), "Unknown");
            boolean mine = !fromStudent && m.getSenderId().equals(c.coordinator().getId());
            return new CommentDto(m.getId(), m.getSenderType().name(), name, m.getMessage(), m.getCreatedAt(), mine);
        }).toList();

        return ResponseEntity.ok(result);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> post(@PathVariable Long requirementId,
                                  @PathVariable Long studentId,
                                  @RequestBody CommentRequest request,
                                  Authentication authentication) {
        Ctx c = context(requirementId, studentId, authentication);
        if (c.error() != null) return c.error();

        String text = request == null || request.message() == null ? "" : request.message().trim();
        if (text.isEmpty()) {
            return ResponseEntity.badRequest().body("Please write a comment.");
        }
        if (text.length() > 2000) {
            return ResponseEntity.badRequest().body("The comment is too long (max 2000 characters).");
        }

        List<DocumentRequirementAttachment> rows =
                attachmentRepository.findByStudentIdAndDocumentRequirementId(studentId, requirementId);

        DocumentRequirementAttachment target;
        if (rows.isEmpty()) {
            // Wala pang naipapasa: gumawa ng record na walang file para may mapagkakabitan ang comment
            DocumentRequirementAttachment record = new DocumentRequirementAttachment();
            record.setDocumentRequirement(c.requirement());
            record.setStudent(c.student());
            record.setFilePath(null);
            record.setStatus("Assigned");
            target = attachmentRepository.save(record);
        } else {
            target = rows.stream().max(Comparator.comparing(DocumentRequirementAttachment::getId)).orElseThrow();
        }

        boolean admin = c.coordinator().getType() == CoordinatorType.ADMIN;

        PrivateDocumentMessage message = new PrivateDocumentMessage();
        message.setFileType(MessageFileType.DOCUMENT_REQUIREMENT_ATTACHMENT);
        message.setFileId(target.getId());
        message.setSenderType(admin ? MessageSenderType.COORDINATOR : MessageSenderType.COORDINATOR_STAFF);
        message.setSenderId(c.coordinator().getId());
        message.setReceiverId(c.student().getId());
        message.setMessage(text);

        PrivateDocumentMessage saved = messageRepository.save(message);

        String who = c.coordinator().getUser().getFullname();
        notifications.save(new StudentNotification(c.student().getId(), "comment:requirement:" + requirementId,
                "New private comment from " + who,
                text.length() > 160 ? text.substring(0, 160) + "…" : text));

        return ResponseEntity.ok(new CommentDto(
                saved.getId(), saved.getSenderType().name(), c.coordinator().getUser().getFullname(),
                saved.getMessage(), saved.getCreatedAt(), true));
    }
}