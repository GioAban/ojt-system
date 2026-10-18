package com.iodev.practicum.controller;

import com.iodev.practicum.dto.StudentProfileDtos.NotificationItem;
import com.iodev.practicum.dto.StudentProfileDtos.NotificationsResponse;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.model.StudentNotification;
import com.iodev.practicum.model.StudentNotificationState;
import com.iodev.practicum.repository.StudentManagementRepository;
import com.iodev.practicum.repository.StudentNotificationFeed;
import com.iodev.practicum.repository.StudentNotificationStateRepository;
import com.iodev.practicum.service.StudentWorkService;
import com.iodev.practicum.service.StudentWorkService.Row;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Mga abiso ng student. Galing ito sa:
 *  - mga naka-save na abiso (company approve/decline, bagong comment ng coordinator)
 *  - mga bagong gawain na inilagay ng coordinator (requirement, weekly report, DTR)
 *  - mga resulta ng check (Checked o Invalid)
 * Ang "unread" ay ang mas bago kaysa sa huling beses na binuksan ng student ang listahan.
 */
@RestController
@RequestMapping("/api/student/notifications")
public class StudentNotificationsController {

    private static final int DAYS = 30;
    private static final int LIMIT = 40;

    @Autowired private StudentManagementRepository studentManagementRepository;
    @Autowired private StudentNotificationFeed feed;
    @Autowired private StudentNotificationStateRepository stateRepository;
    @Autowired private StudentWorkService work;

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> list(Authentication authentication) {
        Student s = current(authentication);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");

        LocalDateTime lastSeen = stateRepository.findById(s.getId())
                .map(StudentNotificationState::getLastSeenAt)
                .orElse(LocalDateTime.now().minusDays(7));
        LocalDateTime since = LocalDateTime.now().minusDays(DAYS);

        List<NotificationItem> items = new ArrayList<>();
        for (StudentNotification n : feed.findTop50ByStudentIdOrderByCreatedAtDesc(s.getId())) {
            if (n.getCreatedAt().isBefore(since)) continue;
            items.add(new NotificationItem("n" + n.getId(), n.getType(), n.getTitle(), n.getMessage(),
                    n.getCreatedAt().toString(), n.getCreatedAt().isAfter(lastSeen), linkFor(n)));
        }

        for (Row r : work.rows(s)) {
            String link = "/student/work/" + r.scope() + "/" + r.id();
            String label = kindLabel(r);
            LocalDateTime created = toLocal(r.createdAt());
            if (created != null && created.isAfter(since)) {
                String due = r.dueDate() == null ? "" : " Due " + toLocal(r.dueDate()).toLocalDate() + ".";
                items.add(new NotificationItem("new-" + r.scope() + "-" + r.id(), "assigned",
                        "New " + label + ": " + r.title(),
                        "Your coordinator added this." + due, created.toString(), created.isAfter(lastSeen), link));
            }
            LocalDateTime updated = toLocal(r.updatedAt());
            if (updated != null && updated.isAfter(since)) {
                if ("CHECKED".equals(r.statusKey())) {
                    items.add(new NotificationItem("checked-" + r.scope() + "-" + r.id(), "checked",
                            r.title() + " was checked", "Your coordinator checked your work.",
                            updated.toString(), updated.isAfter(lastSeen), link));
                } else if ("INVALID".equals(r.statusKey())) {
                    items.add(new NotificationItem("invalid-" + r.scope() + "-" + r.id(), "invalid",
                            r.title() + " needs revision", "Please fix your work and turn it in again.",
                            updated.toString(), updated.isAfter(lastSeen), link));
                }
            }
        }

        items.sort(Comparator.comparing(NotificationItem::createdAt).reversed());
        if (items.size() > LIMIT) items = new ArrayList<>(items.subList(0, LIMIT));
        int unread = (int) items.stream().filter(NotificationItem::unread).count();
        return ResponseEntity.ok(new NotificationsResponse(unread, items));
    }

    /** Markahan na nabasa na lahat */
    @PostMapping("/read")
    @Transactional
    public ResponseEntity<?> markRead(Authentication authentication) {
        Student s = current(authentication);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");
        StudentNotificationState state = stateRepository.findById(s.getId())
                .orElse(new StudentNotificationState(s.getId(), LocalDateTime.now()));
        state.setLastSeenAt(LocalDateTime.now());
        stateRepository.save(state);
        return ResponseEntity.ok().build();
    }

    private static String kindLabel(Row r) {
        return switch (r.scope()) {
            case StudentWorkService.WEEKLY -> "weekly report";
            case StudentWorkService.DTR -> "DTR";
            default -> "requirement";
        };
    }

    /** Ang type ng comment ay "comment:<scope>:<refId>", kaya alam kung saan dadalhin ang student */
    private static String linkFor(StudentNotification n) {
        String type = n.getType() == null ? "" : n.getType().toLowerCase();
        if (type.startsWith("comment:")) {
            String[] parts = type.split(":");
            if (parts.length == 3) return "/student/work/" + parts[1] + "/" + parts[2];
            return "/student/home";
        }
        return type.contains("company") || type.contains("request") ? "/student/companies" : null;
    }

    private static LocalDateTime toLocal(Timestamp t) {
        return t == null ? null : LocalDateTime.ofInstant(t.toInstant(), ZoneId.systemDefault());
    }

    private Student current(Authentication authentication) {
        if (authentication == null) return null;
        return studentManagementRepository.findByEmail(authentication.getName()).stream()
                .max(Comparator.comparing(Student::getId))
                .orElse(null);
    }
}
