package com.iodev.practicum.controller;

import com.iodev.practicum.dto.SubmissionDtos.*;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.CoordinatorType;
import com.iodev.practicum.model.MessageFileType;
import com.iodev.practicum.model.MessageSenderType;
import com.iodev.practicum.model.MonthlyDtr;
import com.iodev.practicum.model.MonthlyWeeklyReport;
import com.iodev.practicum.model.PrivateDocumentMessage;
import com.iodev.practicum.model.SignedDtr;
import com.iodev.practicum.model.SignedWeeklyReport;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.MonthlyDtrRepository;
import com.iodev.practicum.repository.MonthlyWeeklyReportRepository;
import com.iodev.practicum.repository.PrivateDocumentMessageRepository;
import com.iodev.practicum.repository.SignedDtrRepository;
import com.iodev.practicum.repository.SignedWeeklyReportRepository;
import com.iodev.practicum.repository.StudentRepository;
import com.iodev.practicum.model.StudentNotification;
import com.iodev.practicum.repository.StudentNotificationFeed;
import com.iodev.practicum.service.SubmissionFileAccess;
import com.iodev.practicum.storage.FileStorageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Student work ng Weekly report (kind = weekly) at DTR (kind = dtr) */
@RestController
@RequestMapping("/api/coordinator/requirements/{kind}")
public class PeriodSubmissionsController {

    private static final Map<Integer, String> RATING_NAMES =
            Map.of(4, "EXCELLENT", 3, "VERY_GOOD", 2, "GOOD", 1, "POOR");

    @Autowired
    private CoordinatorRepository coordinatorRepository;

    @Autowired
    private MonthlyWeeklyReportRepository weeklyRepository;

    @Autowired
    private MonthlyDtrRepository dtrRepository;

    @Autowired
    private SignedWeeklyReportRepository signedWeeklyRepository;

    @Autowired
    private SignedDtrRepository signedDtrRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private PrivateDocumentMessageRepository messageRepository;

    @Autowired
    private FileStorageService storage;

    @Autowired
    private SubmissionFileAccess studentFiles;

    @Autowired
    private StudentNotificationFeed notifications;

    private record Period(Coordinator coordinator, MonthlyWeeklyReport weekly, MonthlyDtr dtr,
                          Long semesterId, ResponseEntity<?> error) {}

    private record StudentCtx(Period period, Student student, ResponseEntity<?> error) {}

    private static Period failure(ResponseEntity<?> error) {
        return new Period(null, null, null, null, error);
    }

    private Period period(String kind, Long id, Authentication authentication) {
        Coordinator coordinator = coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
        if (coordinator == null) {
            return failure(ResponseEntity.status(403).body("Coordinator profile not found."));
        }

        if ("weekly".equals(kind)) {
            MonthlyWeeklyReport report = weeklyRepository.findById(id).orElse(null);
            if (report == null) return failure(ResponseEntity.notFound().build());
            if (!report.getCoordinator().getId().equals(coordinator.getId())) {
                return failure(ResponseEntity.status(403).body("You can only open your own requirements."));
            }
            return new Period(coordinator, report, null, report.getSemester().getId(), null);
        }

        if ("dtr".equals(kind)) {
            MonthlyDtr dtr = dtrRepository.findById(id).orElse(null);
            if (dtr == null) return failure(ResponseEntity.notFound().build());
            if (!dtr.getCoordinator().getId().equals(coordinator.getId())) {
                return failure(ResponseEntity.status(403).body("You can only open your own requirements."));
            }
            return new Period(coordinator, null, dtr, dtr.getSemester().getId(), null);
        }

        return failure(ResponseEntity.notFound().build());
    }

    private StudentCtx studentContext(String kind, Long id, Long studentId, Authentication authentication) {
        Period p = period(kind, id, authentication);
        if (p.error() != null) return new StudentCtx(null, null, p.error());

        Student student = studentRepository.findById(studentId).orElse(null);
        if (student == null) return new StudentCtx(null, null, ResponseEntity.notFound().build());

        if (!student.getCoordinator().getId().equals(p.coordinator().getId())) {
            return new StudentCtx(null, null,
                    ResponseEntity.status(403).body("You can only comment on your own students' work."));
        }
        if (!student.getSemester().getId().equals(p.semesterId())) {
            return new StudentCtx(null, null,
                    ResponseEntity.badRequest().body("That item doesn't belong to the student's semester."));
        }
        return new StudentCtx(p, student, null);
    }

    // =====================================================================
    // Listahan ng student work
    // =====================================================================

    @GetMapping("/{id}/submissions")
    @Transactional(readOnly = true)
    public ResponseEntity<?> submissions(@PathVariable String kind,
                                         @PathVariable Long id,
                                         Authentication authentication) {
        Period p = period(kind, id, authentication);
        if (p.error() != null) return p.error();

        List<Student> students = studentRepository.findForTracking(p.coordinator().getId(), p.semesterId());
        List<PeriodStudentDto> rows = new ArrayList<>();

        if (p.weekly() != null) {
            Map<Long, List<SignedWeeklyReport>> byStudent = new HashMap<>();
            for (SignedWeeklyReport r : signedWeeklyRepository.findForSubmissions(id)) {
                byStudent.computeIfAbsent(r.getStudent().getId(), k -> new ArrayList<>()).add(r);
            }

            for (Student s : students) {
                Integer ratingValue = null;
                String comment = null;
                List<SubmissionFileDto> files = new ArrayList<>();

                for (SignedWeeklyReport r : byStudent.getOrDefault(s.getId(), List.of())) {
                    if (r.getSupervisorEvaluation() != null) ratingValue = r.getSupervisorEvaluation();
                    String c = r.getSupervisorComment();
                    if (c != null && !c.isBlank()) comment = c;
                    addFile(files, r.getId(), r.getFilePath());
                }

                List<SubmissionFileDto> own = studentFiles.list(s.getId(), "weekly", id);
                if (!own.isEmpty()) files = own;

                String rating = ratingValue == null ? "NONE" : RATING_NAMES.getOrDefault(ratingValue, "NONE");
                String status = ratingValue != null ? "CHECKED" : files.isEmpty() ? "ASSIGNED" : "FOR_CHECKING";

                rows.add(new PeriodStudentDto(s.getId(), s.getStudentNumber(), s.getFirstname(), s.getLastname(),
                        s.getMiddleInitial(), status, files, rating, null, comment));
            }

            MonthlyWeeklyReport w = p.weekly();
            return ResponseEntity.ok(new PeriodSubmissionsResponse(
                    "weekly", w.getId(),
                    w.getMonthFrom().toLocalDate() + " to " + w.getMonthTo().toLocalDate(),
                    w.getDueDate(), Boolean.TRUE.equals(w.getIsArchived()),
                    w.getMonthFrom().toLocalDate(), w.getMonthTo().toLocalDate(), rows));
        }

        Map<Long, List<SignedDtr>> byStudent = new HashMap<>();
        for (SignedDtr r : signedDtrRepository.findForSubmissions(id)) {
            byStudent.computeIfAbsent(r.getStudent().getId(), k -> new ArrayList<>()).add(r);
        }

        for (Student s : students) {
            BigDecimal hours = null;
            List<SubmissionFileDto> files = new ArrayList<>();

            for (SignedDtr r : byStudent.getOrDefault(s.getId(), List.of())) {
                if (r.getHours() != null) hours = r.getHours();
                addFile(files, r.getId(), r.getFilePath());
            }

            List<SubmissionFileDto> own = studentFiles.list(s.getId(), "dtr", id);
            if (!own.isEmpty()) files = own;

            String status = hours != null ? "CHECKED" : files.isEmpty() ? "ASSIGNED" : "FOR_CHECKING";

            rows.add(new PeriodStudentDto(s.getId(), s.getStudentNumber(), s.getFirstname(), s.getLastname(),
                    s.getMiddleInitial(), status, files, null, hours, null));
        }

        MonthlyDtr d = p.dtr();
        String flag = String.valueOf(d.getIsArchived());
        boolean archived = !(flag.equals("0") || flag.equals("null") || flag.equals("false"));

        return ResponseEntity.ok(new PeriodSubmissionsResponse(
                "dtr", d.getId(), d.getMonth(), d.getDueDate(), archived, null, null, rows));
    }

    // =====================================================================
    // Pagbukas ng file na ipinasa
    // =====================================================================

    @GetMapping("/{id}/submissions/{recordId}/file")
    @Transactional(readOnly = true)
    public ResponseEntity<?> file(@PathVariable String kind,
                                  @PathVariable Long id,
                                  @PathVariable Long recordId,
                                  Authentication authentication) {
        Period p = period(kind, id, authentication);
        if (p.error() != null) return p.error();

        // Negatibong id = file na inilagay ng student (submission_files)
        if (recordId < 0) return studentFiles.open(p.coordinator().getId(), -recordId, kind, id);

        String path;
        if (p.weekly() != null) {
            SignedWeeklyReport r = signedWeeklyRepository.findById(recordId).orElse(null);
            if (r == null || !r.getMonthlyWeeklyReport().getId().equals(id)) {
                return ResponseEntity.notFound().build();
            }
            if (!r.getStudent().getCoordinator().getId().equals(p.coordinator().getId())) {
                return ResponseEntity.status(403).body("You can only open your own students' files.");
            }
            path = r.getFilePath();
        } else {
            SignedDtr r = signedDtrRepository.findById(recordId).orElse(null);
            if (r == null || !r.getMonthlyDtr().getId().equals(id)) {
                return ResponseEntity.notFound().build();
            }
            if (!r.getStudent().getCoordinator().getId().equals(p.coordinator().getId())) {
                return ResponseEntity.status(403).body("You can only open your own students' files.");
            }
            path = r.getFilePath();
        }

        if (path == null || path.isBlank() || isLink(path)) {
            return ResponseEntity.badRequest().body("This submission has no file to open.");
        }

        Path resolved = storage.resolve(path);
        if (resolved == null || !Files.isRegularFile(resolved)) {
            return ResponseEntity.status(404).body("File not found on the server.");
        }

        String name = displayName(path);
        MediaType type;
        try {
            type = MediaType.parseMediaType(storage.contentTypeFor(name));
        } catch (RuntimeException e) {
            type = MediaType.APPLICATION_OCTET_STREAM;
        }

        return ResponseEntity.ok()
                .contentType(type)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline().filename(name, StandardCharsets.UTF_8).build().toString())
                .body(new FileSystemResource(resolved));
    }

    // =====================================================================
    // Private comments
    // =====================================================================

    @GetMapping("/{id}/submissions/{studentId}/comments")
    @Transactional(readOnly = true)
    public ResponseEntity<?> comments(@PathVariable String kind,
                                      @PathVariable Long id,
                                      @PathVariable Long studentId,
                                      Authentication authentication) {
        StudentCtx c = studentContext(kind, id, studentId, authentication);
        if (c.error() != null) return c.error();

        boolean weekly = c.period().weekly() != null;
        MessageFileType type = weekly ? MessageFileType.SIGNED_WEEKLY_REPORT : MessageFileType.SIGNED_DTR;

        List<Long> recordIds = weekly
                ? signedWeeklyRepository.findByStudentIdAndMonthlyWeeklyReportId(studentId, id).stream()
                        .map(SignedWeeklyReport::getId).toList()
                : signedDtrRepository.findByStudentIdAndMonthlyDtrId(studentId, id).stream()
                        .map(SignedDtr::getId).toList();

        if (recordIds.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        List<PrivateDocumentMessage> messages =
                messageRepository.findByFileTypeAndFileIdInOrderByCreatedAtAscIdAsc(type, recordIds);

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

        Long me = c.period().coordinator().getId();

        List<RequirementCommentsController.CommentDto> result = messages.stream().map(m -> {
            boolean fromStudent = m.getSenderType() == MessageSenderType.STUDENT;
            String name = (fromStudent ? studentNames : coordinatorNames).getOrDefault(m.getSenderId(), "Unknown");
            boolean mine = !fromStudent && m.getSenderId().equals(me);
            return new RequirementCommentsController.CommentDto(
                    m.getId(), m.getSenderType().name(), name, m.getMessage(), m.getCreatedAt(), mine);
        }).toList();

        return ResponseEntity.ok(result);
    }

    @PostMapping("/{id}/submissions/{studentId}/comments")
    @Transactional
    public ResponseEntity<?> postComment(@PathVariable String kind,
                                         @PathVariable Long id,
                                         @PathVariable Long studentId,
                                         @RequestBody RequirementCommentsController.CommentRequest request,
                                         Authentication authentication) {
        StudentCtx c = studentContext(kind, id, studentId, authentication);
        if (c.error() != null) return c.error();

        String text = request == null || request.message() == null ? "" : request.message().trim();
        if (text.isEmpty()) {
            return ResponseEntity.badRequest().body("Please write a comment.");
        }
        if (text.length() > 2000) {
            return ResponseEntity.badRequest().body("The comment is too long (max 2000 characters).");
        }

        Coordinator coordinator = c.period().coordinator();
        Student student = c.student();
        boolean weekly = c.period().weekly() != null;
        Long targetId;

        if (weekly) {
            List<SignedWeeklyReport> rows =
                    signedWeeklyRepository.findByStudentIdAndMonthlyWeeklyReportId(studentId, id);
            if (rows.isEmpty()) {
                // Wala pang record: gumawa ng walang-file na record para may mapagkakabitan ang comment
                SignedWeeklyReport created = new SignedWeeklyReport();
                created.setMonthlyWeeklyReport(c.period().weekly());
                created.setStudent(student);
                created.setStatus("Assigned");
                targetId = signedWeeklyRepository.save(created).getId();
            } else {
                targetId = rows.stream().max(Comparator.comparing(SignedWeeklyReport::getId)).orElseThrow().getId();
            }
        } else {
            List<SignedDtr> rows = signedDtrRepository.findByStudentIdAndMonthlyDtrId(studentId, id);
            if (rows.isEmpty()) {
                SignedDtr created = new SignedDtr();
                created.setMonthlyDtr(c.period().dtr());
                created.setStudent(student);
                created.setStatus("Assigned");
                targetId = signedDtrRepository.save(created).getId();
            } else {
                targetId = rows.stream().max(Comparator.comparing(SignedDtr::getId)).orElseThrow().getId();
            }
        }

        boolean admin = coordinator.getType() == CoordinatorType.ADMIN;

        PrivateDocumentMessage message = new PrivateDocumentMessage();
        message.setFileType(weekly ? MessageFileType.SIGNED_WEEKLY_REPORT : MessageFileType.SIGNED_DTR);
        message.setFileId(targetId);
        message.setSenderType(admin ? MessageSenderType.COORDINATOR : MessageSenderType.COORDINATOR_STAFF);
        message.setSenderId(coordinator.getId());
        message.setReceiverId(student.getId());
        message.setMessage(text);

        PrivateDocumentMessage saved = messageRepository.save(message);

        String who = coordinator.getUser().getFullname();
        notifications.save(new StudentNotification(student.getId(), "comment:" + kind + ":" + id,
                "New private comment from " + who,
                text.length() > 160 ? text.substring(0, 160) + "…" : text));

        return ResponseEntity.ok(new RequirementCommentsController.CommentDto(
                saved.getId(), saved.getSenderType().name(), coordinator.getUser().getFullname(),
                saved.getMessage(), saved.getCreatedAt(), true));
    }

    // =====================================================================
    // Mga helper
    // =====================================================================

    private static void addFile(List<SubmissionFileDto> files, Long id, String path) {
        if (path == null || path.isBlank()) return;
        boolean link = isLink(path);
        files.add(new SubmissionFileDto(id, link ? "LINK" : "FILE",
                link ? path : displayName(path), link ? path : null));
    }

    private static boolean isLink(String path) {
        return path.regionMatches(true, 0, "http://", 0, 7) || path.regionMatches(true, 0, "https://", 0, 8);
    }

    private static String displayName(String path) {
        String normalized = path.replace('\\', '/');
        return normalized.substring(normalized.lastIndexOf('/') + 1);
    }
}