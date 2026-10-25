package com.iodev.practicum.controller;

import com.iodev.practicum.model.Announcement;
import com.iodev.practicum.model.AnnouncementFile;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.AnnouncementFileRepository;
import com.iodev.practicum.repository.AnnouncementRepository;
import com.iodev.practicum.repository.StudentManagementRepository;
import com.iodev.practicum.service.AnnouncementFileService;
import com.iodev.practicum.service.AnnouncementFileService.FileItem;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/** Makikita ng student ang announcements ng coordinator niya sa semester niya. Read-only. */
@RestController
@RequestMapping("/api/student/announcements")
public class StudentAnnouncementsController {

    public record AnnouncementItem(Long id, String title, String message, boolean pinned, String postedBy,
                                   String createdAt, List<FileItem> files) {}

    @Autowired private StudentManagementRepository studentManagementRepository;
    @Autowired private AnnouncementRepository announcements;
    @Autowired private AnnouncementFileRepository files;
    @Autowired private AnnouncementFileService fileService;

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> list(Authentication authentication) {
        Student s = current(authentication);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");
        if (s.getCoordinator() == null || s.getSemester() == null) return ResponseEntity.ok(List.of());

        List<Announcement> list = announcements.findByCoordinatorIdAndSemesterIdOrderByIsPinnedDescCreatedAtDesc(
                s.getCoordinator().getId(), s.getSemester().getId());

        Map<Long, List<FileItem>> byAnnouncement = new HashMap<>();
        if (!list.isEmpty()) {
            for (AnnouncementFile f : files.findByAnnouncementIdIn(list.stream().map(Announcement::getId).toList())) {
                byAnnouncement.computeIfAbsent(f.getAnnouncement().getId(), k -> new ArrayList<>())
                        .add(fileService.item(f));
            }
        }
        List<AnnouncementItem> out = new ArrayList<>();
        for (Announcement a : list) {
            out.add(new AnnouncementItem(a.getId(), a.getTitle(), a.getMessage(), Boolean.TRUE.equals(a.getIsPinned()),
                    CoordinatorAnnouncementsController.postedBy(a),
                    a.getCreatedAt() == null ? "" : a.getCreatedAt().toInstant().toString(),
                    byAnnouncement.getOrDefault(a.getId(), List.of())));
        }
        return ResponseEntity.ok(out);
    }

    @GetMapping("/{id}/files/{fileId}")
    @Transactional(readOnly = true)
    public ResponseEntity<?> file(@PathVariable Long id, @PathVariable Long fileId, Authentication authentication) {
        Student s = current(authentication);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");
        Announcement a = announcements.findById(id).orElse(null);
        // Sa sariling coordinator at semester lang ng student
        if (a == null || s.getCoordinator() == null || s.getSemester() == null
                || !a.getCoordinator().getId().equals(s.getCoordinator().getId())
                || !a.getSemester().getId().equals(s.getSemester().getId())) {
            return ResponseEntity.notFound().build();
        }
        AnnouncementFile f = files.findByIdAndAnnouncementId(fileId, id).orElse(null);
        if (f == null) return ResponseEntity.notFound().build();
        return fileService.download(f);
    }

    private Student current(Authentication authentication) {
        if (authentication == null) return null;
        return studentManagementRepository.findByEmail(authentication.getName()).stream()
                .max(Comparator.comparing(Student::getId))
                .orElse(null);
    }
}
