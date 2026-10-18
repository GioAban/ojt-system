package com.iodev.practicum.controller;

import com.iodev.practicum.dto.StudentProfileDtos.CommentItem;
import com.iodev.practicum.dto.StudentProfileDtos.CommentRequest;
import com.iodev.practicum.dto.StudentProfileDtos.LinkRequest;
import com.iodev.practicum.dto.StudentProfileDtos.SubmissionItem;
import com.iodev.practicum.dto.StudentProfileDtos.TurnInRequest;
import com.iodev.practicum.dto.StudentProfileDtos.WorkDetail;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.DocumentRequirementAttachment;
import com.iodev.practicum.model.MessageFileType;
import com.iodev.practicum.model.MessageSenderType;
import com.iodev.practicum.model.PrivateDocumentMessage;
import com.iodev.practicum.model.SignedDtr;
import com.iodev.practicum.model.SignedWeeklyReport;
import com.iodev.practicum.model.SubmissionFile;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.DocumentRequirementAttachmentRepository;
import com.iodev.practicum.repository.PrivateDocumentMessageRepository;
import com.iodev.practicum.repository.SignedDtrRepository;
import com.iodev.practicum.repository.SignedWeeklyReportRepository;
import com.iodev.practicum.repository.StudentManagementRepository;
import com.iodev.practicum.repository.SubmissionFileRepository;
import com.iodev.practicum.service.RequirementStorage;
import com.iodev.practicum.service.CoordinatorNotifier;
import com.iodev.practicum.service.StudentWorkService;
import com.iodev.practicum.service.StudentWorkService.Row;
import com.iodev.practicum.service.StudentWorkService.Slot;
import com.iodev.practicum.util.SubmissionStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Ang pahina ng isang gawain para sa student: requirement, weekly report o DTR.
 * Instructions, template, mga file/link, Turn in, Unsubmit at private comments.
 * Kapag Checked na, naka-lock na ito.
 */
@RestController
@RequestMapping("/api/student/work/{scope}/{refId}")
public class StudentWorkController {

    private static final long MAX_BYTES = 25L * 1024 * 1024;
    private static final int MAX_ITEMS = 10;
    private static final BigDecimal MAX_HOURS = new BigDecimal("744");

    @Autowired private StudentManagementRepository studentManagementRepository;
    @Autowired private StudentWorkService work;
    @Autowired private SubmissionFileRepository fileRepository;
    @Autowired private PrivateDocumentMessageRepository messageRepository;
    @Autowired private CoordinatorRepository coordinatorRepository;
    @Autowired private DocumentRequirementAttachmentRepository attachmentRepository;
    @Autowired private SignedWeeklyReportRepository signedWeeklyRepository;
    @Autowired private SignedDtrRepository signedDtrRepository;
    @Autowired private RequirementStorage storage;
    @Autowired private CoordinatorNotifier coordinatorNotifier;

    @GetMapping
    @Transactional
    public ResponseEntity<?> detail(@PathVariable String scope, @PathVariable Long refId, Authentication auth) {
        Student s = current(auth);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");
        Row row = work.find(s, scope, refId);
        if (row == null) return ResponseEntity.status(404).body("Not found.");
        return ResponseEntity.ok(build(s, work.slot(s, row, false)));
    }

    @PostMapping("/files")
    @Transactional
    public ResponseEntity<?> upload(@PathVariable String scope, @PathVariable Long refId,
                                    @RequestParam("file") MultipartFile file, Authentication auth) {
        Student s = current(auth);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");
        Row row = work.find(s, scope, refId);
        if (row == null) return ResponseEntity.status(404).body("Not found.");
        if (!storage.configured()) return ResponseEntity.status(503).body("File uploads aren't set up yet.");
        if (file == null || file.isEmpty()) return ResponseEntity.badRequest().body("Choose a file first.");
        if (file.getSize() > MAX_BYTES) return ResponseEntity.badRequest().body("That file is too big. The limit is 25 MB.");

        Slot slot = work.slot(s, row, false);
        ResponseEntity<?> blocked = editBlock(slot);
        if (blocked != null) return blocked;
        if (count(s, scope, refId) >= MAX_ITEMS) {
            return ResponseEntity.badRequest().body("You can add up to " + MAX_ITEMS + " items.");
        }

        String original = cleanName(file.getOriginalFilename());
        String key = "submissions/" + s.getId() + "/" + scope + "-" + refId + "/" + UUID.randomUUID() + "-" + original;
        try {
            storage.put(key, file.getInputStream(), file.getSize(), file.getContentType());
        } catch (IOException | RuntimeException e) {
            return ResponseEntity.status(502).body("The upload failed. Please try again.");
        }

        slot = work.slot(s, row, true);
        SubmissionFile f = new SubmissionFile();
        f.setStudentId(s.getId());
        f.setScope(scope);
        f.setRefId(refId);
        f.setKind("FILE");
        f.setName(original);
        f.setPath(key);
        f.setSizeBytes(file.getSize());
        fileRepository.save(f);
        syncFilePath(s, scope, refId, slot);
        return ResponseEntity.ok(build(s, slot));
    }

    @PostMapping("/links")
    @Transactional
    public ResponseEntity<?> addLink(@PathVariable String scope, @PathVariable Long refId,
                                     @RequestBody LinkRequest body, Authentication auth) {
        Student s = current(auth);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");
        Row row = work.find(s, scope, refId);
        if (row == null) return ResponseEntity.status(404).body("Not found.");

        String url = body == null || body.url() == null ? "" : body.url().trim();
        if (!url.matches("(?i)^https?://.+") || url.length() > 900) {
            return ResponseEntity.badRequest().body("Enter a valid link that starts with http:// or https://");
        }
        try { URI.create(url); } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body("That link doesn't look right.");
        }

        Slot slot = work.slot(s, row, false);
        ResponseEntity<?> blocked = editBlock(slot);
        if (blocked != null) return blocked;
        if (count(s, scope, refId) >= MAX_ITEMS) {
            return ResponseEntity.badRequest().body("You can add up to " + MAX_ITEMS + " items.");
        }

        slot = work.slot(s, row, true);
        String name = body.name() == null || body.name().isBlank() ? hostOf(url) : body.name().trim();
        SubmissionFile f = new SubmissionFile();
        f.setStudentId(s.getId());
        f.setScope(scope);
        f.setRefId(refId);
        f.setKind("LINK");
        f.setName(name.length() > 200 ? name.substring(0, 200) : name);
        f.setPath(url);
        fileRepository.save(f);
        syncFilePath(s, scope, refId, slot);
        return ResponseEntity.ok(build(s, slot));
    }

    @DeleteMapping("/items/{itemId}")
    @Transactional
    public ResponseEntity<?> removeItem(@PathVariable String scope, @PathVariable Long refId,
                                        @PathVariable Long itemId, Authentication auth) {
        Student s = current(auth);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");
        Row row = work.find(s, scope, refId);
        if (row == null) return ResponseEntity.status(404).body("Not found.");

        Slot slot = work.slot(s, row, false);
        ResponseEntity<?> blocked = editBlock(slot);
        if (blocked != null) return blocked;

        SubmissionFile f = fileRepository.findById(itemId).orElse(null);
        if (f == null || !f.getStudentId().equals(s.getId()) || !f.getScope().equals(scope) || !f.getRefId().equals(refId)) {
            return ResponseEntity.status(404).body("Item not found.");
        }
        if ("FILE".equals(f.getKind())) {
            try { storage.delete(f.getPath()); } catch (RuntimeException ignored) { /* hindi kritikal */ }
        }
        fileRepository.delete(f);
        fileRepository.flush();
        syncFilePath(s, scope, refId, slot);
        return ResponseEntity.ok(build(s, slot));
    }

    @PostMapping("/turn-in")
    @Transactional
    public ResponseEntity<?> turnIn(@PathVariable String scope, @PathVariable Long refId,
                                    @RequestBody(required = false) TurnInRequest body, Authentication auth) {
        Student s = current(auth);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");
        Row row = work.find(s, scope, refId);
        if (row == null) return ResponseEntity.status(404).body("Not found.");

        Slot slot = work.slot(s, row, false);
        ResponseEntity<?> blocked = editBlock(slot);
        if (blocked != null) return blocked;
        if (count(s, scope, refId) == 0) {
            return ResponseEntity.badRequest().body("Add a file or a link before turning in.");
        }

        if (StudentWorkService.DTR.equals(scope)) {
            BigDecimal hours = body == null ? null : body.hours();
            if (hours == null || hours.signum() < 0 || hours.compareTo(MAX_HOURS) > 0) {
                return ResponseEntity.badRequest().body("Enter the hours you rendered this month (0 to 744).");
            }
            slot.setHours(hours);
        }
        slot.setStatus(SubmissionStatus.FOR_CHECKING);
        slot.save();

        String detail = StudentWorkService.DTR.equals(scope) && slot.hours() != null
                ? slot.hours().stripTrailingZeros().toPlainString() + " hours reported"
                : count(s, scope, refId) + (count(s, scope, refId) == 1 ? " attachment" : " attachments");
        coordinatorNotifier.fromStudent(s, "turned_in",
                fullName(s) + " turned in " + row.title(), detail,
                CoordinatorNotifier.workLink(scope, refId, s.getId()));
        return ResponseEntity.ok(build(s, slot));
    }

    @PostMapping("/unsubmit")
    @Transactional
    public ResponseEntity<?> unsubmit(@PathVariable String scope, @PathVariable Long refId, Authentication auth) {
        Student s = current(auth);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");
        Row row = work.find(s, scope, refId);
        if (row == null) return ResponseEntity.status(404).body("Not found.");

        Slot slot = work.slot(s, row, false);
        if ("CHECKED".equals(slot.statusKey())) {
            return ResponseEntity.status(409).body("This was already checked by your coordinator, so it can't be changed.");
        }
        if (!"FOR_CHECKING".equals(slot.statusKey())) {
            return ResponseEntity.badRequest().body("This isn't turned in.");
        }
        slot.setStatus(SubmissionStatus.ASSIGNED);
        slot.save();
        return ResponseEntity.ok(build(s, slot));
    }

    // ---- private comments ----
    // Iisang usapan ito sa private_document_messages, kapareho ng nakikita ng coordinator sa
    // page ng Student work. Nakakabit ito sa talaan ng student (attachment / signed DTR / signed weekly).

    @GetMapping("/comments")
    @Transactional(readOnly = true)
    public ResponseEntity<?> comments(@PathVariable String scope, @PathVariable Long refId, Authentication auth) {
        Student s = current(auth);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");
        if (work.find(s, scope, refId) == null) return ResponseEntity.status(404).body("Not found.");
        return ResponseEntity.ok(threadFor(s, scope, refId));
    }

    @PostMapping("/comments")
    @Transactional
    public ResponseEntity<?> addComment(@PathVariable String scope, @PathVariable Long refId,
                                        @RequestBody CommentRequest body, Authentication auth) {
        Student s = current(auth);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");
        Row row = work.find(s, scope, refId);
        if (row == null) return ResponseEntity.status(404).body("Not found.");

        String text = body == null || body.body() == null ? "" : body.body().trim();
        if (text.isEmpty()) return ResponseEntity.badRequest().body("Write your comment first.");
        if (text.length() > 2000) return ResponseEntity.badRequest().body("Your comment is too long (2000 characters max).");

        // Kung wala pang talaan ang student para sa gawain, gagawa nito para may mapagkakabitan
        Slot slot = work.slot(s, row, true);
        PrivateDocumentMessage message = new PrivateDocumentMessage();
        message.setFileType(threadType(scope));
        message.setFileId(slot.id());
        message.setSenderType(MessageSenderType.STUDENT);
        message.setSenderId(s.getId());
        message.setReceiverId(s.getCoordinator() == null ? null : s.getCoordinator().getId());
        message.setMessage(text);
        messageRepository.save(message);
        messageRepository.flush();
        coordinatorNotifier.fromStudent(s, "comment",
                fullName(s) + " sent a private comment on " + row.title(), text,
                CoordinatorNotifier.workLink(scope, refId, s.getId()));
        return ResponseEntity.ok(threadFor(s, scope, refId));
    }

    private static String fullName(Student s) {
        return ((s.getFirstname() == null ? "" : s.getFirstname()) + " "
                + (s.getLastname() == null ? "" : s.getLastname())).trim();
    }

    private static MessageFileType threadType(String scope) {
        return switch (scope) {
            case StudentWorkService.DTR -> MessageFileType.SIGNED_DTR;
            case StudentWorkService.WEEKLY -> MessageFileType.SIGNED_WEEKLY_REPORT;
            default -> MessageFileType.DOCUMENT_REQUIREMENT_ATTACHMENT;
        };
    }

    /** Lahat ng talaan ng student para sa gawain (maaaring higit sa isa sa lumang data) */
    private List<Long> threadIds(Long studentId, String scope, Long refId) {
        return switch (scope) {
            case StudentWorkService.DTR -> signedDtrRepository
                    .findByStudentIdAndMonthlyDtrId(studentId, refId).stream().map(SignedDtr::getId).toList();
            case StudentWorkService.WEEKLY -> signedWeeklyRepository
                    .findByStudentIdAndMonthlyWeeklyReportId(studentId, refId).stream().map(SignedWeeklyReport::getId).toList();
            default -> attachmentRepository
                    .findByStudentIdAndDocumentRequirementId(studentId, refId).stream()
                    .map(DocumentRequirementAttachment::getId).toList();
        };
    }

    private List<CommentItem> threadFor(Student s, String scope, Long refId) {
        List<Long> ids = threadIds(s.getId(), scope, refId);
        if (ids.isEmpty()) return List.of();

        List<PrivateDocumentMessage> messages = messageRepository
                .findByFileTypeAndFileIdInOrderByCreatedAtAscIdAsc(threadType(scope), ids);

        Set<Long> coordinatorIds = new HashSet<>();
        for (PrivateDocumentMessage m : messages) {
            if (m.getSenderType() != MessageSenderType.STUDENT) coordinatorIds.add(m.getSenderId());
        }
        Map<Long, String> coordinatorNames = new HashMap<>();
        for (Coordinator c : coordinatorRepository.findAllById(coordinatorIds)) {
            coordinatorNames.put(c.getId(), c.getUser() == null ? "Coordinator" : c.getUser().getFullname());
        }

        String myName = ((s.getFirstname() == null ? "" : s.getFirstname()) + " "
                + (s.getLastname() == null ? "" : s.getLastname())).trim();

        List<CommentItem> out = new ArrayList<>();
        for (PrivateDocumentMessage m : messages) {
            boolean fromStudent = m.getSenderType() == MessageSenderType.STUDENT;
            boolean mine = fromStudent && s.getId().equals(m.getSenderId());
            String name = fromStudent
                    ? (mine ? myName : "Student")
                    : coordinatorNames.getOrDefault(m.getSenderId(), "Coordinator");
            out.add(new CommentItem(m.getId(), fromStudent ? "STUDENT" : "COORDINATOR", name, m.getMessage(),
                    m.getCreatedAt() == null ? "" : m.getCreatedAt().toInstant().toString(), mine));
        }
        return out;
    }

    // ---- helpers ----

    private static ResponseEntity<?> editBlock(Slot slot) {
        String key = slot.statusKey();
        if ("CHECKED".equals(key)) {
            return ResponseEntity.status(409).body("This was already checked by your coordinator, so it can't be changed.");
        }
        if ("FOR_CHECKING".equals(key)) {
            return ResponseEntity.status(409).body("Unsubmit first if you want to change your work.");
        }
        return null;
    }

    private int count(Student s, String scope, Long refId) {
        return fileRepository.findByStudentIdAndScopeAndRefIdOrderByIdAsc(s.getId(), scope, refId).size();
    }

    /** Ang una pong file (o kung wala, ang unang link) ang nasa filePath, para gumana ang review ng coordinator */
    private void syncFilePath(Student s, String scope, Long refId, Slot slot) {
        String firstFile = null;
        String firstLink = null;
        for (SubmissionFile f : fileRepository.findByStudentIdAndScopeAndRefIdOrderByIdAsc(s.getId(), scope, refId)) {
            if ("FILE".equals(f.getKind()) && firstFile == null) firstFile = f.getPath();
            if ("LINK".equals(f.getKind()) && firstLink == null) firstLink = f.getPath();
        }
        slot.setFilePath(firstFile != null ? firstFile : firstLink);
        slot.save();
    }

    private WorkDetail build(Student s, Slot slot) {
        Row row = slot.row();
        String statusKey = slot.statusKey();

        List<SubmissionItem> items = new ArrayList<>();
        for (SubmissionFile f : fileRepository.findByStudentIdAndScopeAndRefIdOrderByIdAsc(
                s.getId(), row.scope(), row.id())) {
            String url = f.getPath();
            if ("FILE".equals(f.getKind())) {
                try { url = storage.presignGet(f.getPath(), Duration.ofMinutes(30)); }
                catch (RuntimeException e) { url = null; }
            }
            items.add(new SubmissionItem(f.getId(), f.getKind(), f.getName(), url, f.getSizeBytes()));
        }

        String templateUrl = null;
        String templateName = null;
        if (row.template() != null && !row.template().isBlank()) {
            String t = row.template().trim();
            templateName = t.substring(t.lastIndexOf('/') + 1);
            try { templateUrl = storage.presignGet(t, Duration.ofMinutes(30)); }
            catch (RuntimeException e) { templateUrl = null; }
        }

        boolean editable = "ASSIGNED".equals(statusKey) || "INVALID".equals(statusKey);
        BigDecimal hours = slot.hours() != null ? slot.hours() : row.hours();
        return new WorkDetail(
                row.scope(), row.id(), row.title(), row.subtitle(), row.type(), row.instructions(),
                row.dueDate() == null ? null : row.dueDate().toInstant().toString(),
                StudentWorkService.statusLabel(statusKey), templateName, templateUrl,
                editable, editable && !items.isEmpty(), "FOR_CHECKING".equals(statusKey),
                StudentWorkService.DTR.equals(row.scope()), hours, items);
    }

    private Student current(Authentication authentication) {
        if (authentication == null) return null;
        return studentManagementRepository.findByEmail(authentication.getName()).stream()
                .max(Comparator.comparing(Student::getId))
                .orElse(null);
    }

    private static String cleanName(String name) {
        String n = name == null || name.isBlank() ? "file" : name;
        n = n.substring(Math.max(n.lastIndexOf('/'), n.lastIndexOf('\\')) + 1);
        n = n.replaceAll("[^A-Za-z0-9._ -]", "_");
        return n.length() > 120 ? n.substring(n.length() - 120) : n;
    }

    private static String hostOf(String url) {
        try {
            String h = URI.create(url).getHost();
            return h == null ? url : h;
        } catch (IllegalArgumentException e) {
            return url;
        }
    }
}
