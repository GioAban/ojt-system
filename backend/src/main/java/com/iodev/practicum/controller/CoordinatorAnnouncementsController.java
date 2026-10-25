package com.iodev.practicum.controller;

import com.iodev.practicum.model.Announcement;
import com.iodev.practicum.model.AnnouncementFile;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.Semester;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.model.StudentNotification;
import com.iodev.practicum.repository.AnnouncementFileRepository;
import com.iodev.practicum.repository.AnnouncementRepository;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.StudentNotificationRepository;
import com.iodev.practicum.service.AnnouncementFileService;
import com.iodev.practicum.service.AnnouncementFileService.FileItem;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.*;

/** Announcements ng coordinator: gumawa, mag-edit, magbura, at mag-attach ng PDF o larawan. */
@RestController
@RequestMapping("/api/coordinator/announcements")
public class CoordinatorAnnouncementsController {

    public record AnnouncementItem(Long id, String title, String message, boolean pinned, String postedBy,
                                   String createdAt, String updatedAt, List<FileItem> files) {}

    @Autowired private CoordinatorRepository coordinatorRepository;
    @Autowired private AnnouncementRepository announcements;
    @Autowired private AnnouncementFileRepository files;
    @Autowired private AnnouncementFileService fileService;
    @Autowired private StudentNotificationRepository studentNotifications;
    @PersistenceContext private EntityManager em;

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> list(@RequestParam Long semesterId, Authentication authentication) {
        Coordinator c = current(authentication);
        if (c == null) return noProfile();

        List<Announcement> list = announcements
                .findByCoordinatorIdAndSemesterIdOrderByIsPinnedDescCreatedAtDesc(c.getId(), semesterId);
        return ResponseEntity.ok(toItems(list));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public ResponseEntity<?> create(@RequestParam Long semesterId,
                                    @RequestParam String title,
                                    @RequestParam String message,
                                    @RequestParam(defaultValue = "false") boolean pinned,
                                    @RequestParam(value = "files", required = false) List<MultipartFile> upload,
                                    Authentication authentication) {
        Coordinator c = current(authentication);
        if (c == null) return noProfile();

        String t = title == null ? "" : title.trim();
        String m = message == null ? "" : message.trim();
        if (t.isEmpty() || t.length() > 255) return bad("Enter a title (up to 255 characters).");
        if (m.isEmpty()) return bad("Write the announcement.");

        List<MultipartFile> incoming = nonEmpty(upload);
        String problem = fileService.validate(incoming, 0);
        if (problem != null) return bad(problem);

        Announcement a = new Announcement();
        a.setCoordinator(c);
        a.setSemester(em.getReference(Semester.class, semesterId));
        a.setTitle(t);
        a.setMessage(m);
        a.setIsPinned(pinned);
        a = announcements.save(a);

        try {
            fileService.store(a, incoming);
        } catch (IOException e) {
            throw new IllegalStateException("Couldn't save the files.", e); // ibabalik ang transaction
        }

        notifyStudents(c, semesterId, a);
        return ResponseEntity.ok(toItems(List.of(a)).get(0));
    }

    /** Pag-edit (hindi na muling magno-notify). removeFileIds = mga attachment na aalisin. */
    @PostMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public ResponseEntity<?> update(@PathVariable Long id,
                                    @RequestParam String title,
                                    @RequestParam String message,
                                    @RequestParam(defaultValue = "false") boolean pinned,
                                    @RequestParam(value = "removeFileIds", required = false) List<Long> removeIds,
                                    @RequestParam(value = "files", required = false) List<MultipartFile> upload,
                                    Authentication authentication) {
        Coordinator c = current(authentication);
        if (c == null) return noProfile();
        Announcement a = announcements.findById(id).orElse(null);
        if (a == null) return ResponseEntity.notFound().build();
        if (!a.getCoordinator().getId().equals(c.getId())) return ResponseEntity.status(403).body("Not your announcement.");

        String t = title == null ? "" : title.trim();
        String m = message == null ? "" : message.trim();
        if (t.isEmpty() || t.length() > 255) return bad("Enter a title (up to 255 characters).");
        if (m.isEmpty()) return bad("Write the announcement.");

        Set<Long> remove = removeIds == null ? Set.of() : new HashSet<>(removeIds);
        List<AnnouncementFile> current = files.findByAnnouncementIdOrderByIdAsc(a.getId());
        long keeping = current.stream().filter(f -> !remove.contains(f.getId())).count();

        List<MultipartFile> incoming = nonEmpty(upload);
        String problem = fileService.validate(incoming, keeping);
        if (problem != null) return bad(problem);

        a.setTitle(t);
        a.setMessage(m);
        a.setIsPinned(pinned);
        announcements.save(a);

        for (AnnouncementFile f : current) {
            if (remove.contains(f.getId())) fileService.delete(f);
        }
        try {
            fileService.store(a, incoming);
        } catch (IOException e) {
            throw new IllegalStateException("Couldn't save the files.", e);
        }
        return ResponseEntity.ok(toItems(List.of(a)).get(0));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> delete(@PathVariable Long id, Authentication authentication) {
        Coordinator c = current(authentication);
        if (c == null) return noProfile();
        Announcement a = announcements.findById(id).orElse(null);
        if (a == null) return ResponseEntity.notFound().build();
        if (!a.getCoordinator().getId().equals(c.getId())) return ResponseEntity.status(403).body("Not your announcement.");

        fileService.deleteAllOf(a.getId());
        announcements.delete(a);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}/files/{fileId}")
    @Transactional(readOnly = true)
    public ResponseEntity<?> file(@PathVariable Long id, @PathVariable Long fileId, Authentication authentication) {
        Coordinator c = current(authentication);
        if (c == null) return noProfile();
        Announcement a = announcements.findById(id).orElse(null);
        if (a == null || !a.getCoordinator().getId().equals(c.getId())) return ResponseEntity.notFound().build();
        AnnouncementFile f = files.findByIdAndAnnouncementId(fileId, id).orElse(null);
        if (f == null) return ResponseEntity.notFound().build();
        return fileService.download(f);
    }

    // ---------------------------------------------------------------------

    /** Abiso sa bell ng bawat student ng coordinator sa semester na ito */
    private void notifyStudents(Coordinator c, Long semesterId, Announcement a) {
        List<Student> students = em.createQuery(
                        "select s from Student s where s.coordinator.id = :c and s.semester.id = :sem", Student.class)
                .setParameter("c", c.getId())
                .setParameter("sem", semesterId)
                .getResultList();
        String preview = a.getMessage().length() > 200 ? a.getMessage().substring(0, 200) + "…" : a.getMessage();
        List<StudentNotification> batch = new ArrayList<>();
        for (Student s : students) {
            if (Boolean.TRUE.equals(s.getIsArchived())) continue;
            batch.add(new StudentNotification(s.getId(), "announcement", "New announcement: " + a.getTitle(), preview));
        }
        studentNotifications.saveAll(batch);
    }

    private List<AnnouncementItem> toItems(List<Announcement> list) {
        Map<Long, List<FileItem>> byAnnouncement = new HashMap<>();
        if (!list.isEmpty()) {
            List<Long> ids = list.stream().map(Announcement::getId).toList();
            for (AnnouncementFile f : files.findByAnnouncementIdIn(ids)) {
                byAnnouncement.computeIfAbsent(f.getAnnouncement().getId(), k -> new ArrayList<>())
                        .add(fileService.item(f));
            }
        }
        List<AnnouncementItem> out = new ArrayList<>();
        for (Announcement a : list) {
            out.add(new AnnouncementItem(a.getId(), a.getTitle(), a.getMessage(), Boolean.TRUE.equals(a.getIsPinned()),
                    postedBy(a),
                    a.getCreatedAt() == null ? "" : a.getCreatedAt().toInstant().toString(),
                    a.getUpdatedAt() == null ? "" : a.getUpdatedAt().toInstant().toString(),
                    byAnnouncement.getOrDefault(a.getId(), List.of())));
        }
        return out;
    }

    static String postedBy(Announcement a) {
        Coordinator c = a.getCoordinator();
        if (c == null || c.getUser() == null || c.getUser().getFullname() == null) return "";
        return c.getUser().getFullname().trim();
    }

    private static List<MultipartFile> nonEmpty(List<MultipartFile> in) {
        return in == null ? List.of() : in.stream().filter(f -> f != null && !f.isEmpty()).toList();
    }

    private Coordinator current(Authentication authentication) {
        return coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
    }

    private ResponseEntity<?> noProfile() {
        return ResponseEntity.status(403).body("Coordinator profile not found.");
    }

    private ResponseEntity<?> bad(String message) {
        return ResponseEntity.badRequest().body(message);
    }
}
