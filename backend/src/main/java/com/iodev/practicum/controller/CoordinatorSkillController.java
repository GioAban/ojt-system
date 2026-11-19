package com.iodev.practicum.controller;

import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.CoordinatorType;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.StudentRepository;
import com.iodev.practicum.service.ActionException;
import com.iodev.practicum.service.SkillService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Skills para sa coordinator: mungkahi, skills ng sariling student, at ang Skills manager.
 * Ang catalog ay iisa para sa lahat, kaya ang rename, merge at delete ay para sa admin coordinator lang.
 */
@RestController
@RequestMapping("/api/coordinator/skills")
public class CoordinatorSkillController {

    public record SkillsBody(List<String> skills) {}
    public record CatalogResponse(boolean canManage, List<SkillService.SkillUsage> skills) {}
    public record RenameBody(String name) {}
    public record MergeBody(Long targetId) {}

    @Autowired private CoordinatorRepository coordinators;
    @Autowired private StudentRepository students;
    @Autowired private SkillService skillService;

    @GetMapping("/search")
    @Transactional(readOnly = true)
    public ResponseEntity<?> search(@RequestParam(defaultValue = "") String q) {
        return ResponseEntity.ok(skillService.search(q));
    }

    // ---- Skills ng student (Students page) ----

    @GetMapping("/students/{studentId}")
    @Transactional(readOnly = true)
    public ResponseEntity<?> studentSkills(@PathVariable Long studentId, Authentication auth) {
        Coordinator c = current(auth);
        if (c == null) return noProfile();
        Student s = students.findById(studentId).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();
        if (!s.getCoordinator().getId().equals(c.getId())) return ResponseEntity.status(403).body("You can only view your own students.");
        return ResponseEntity.ok(new SkillsBody(skillService.studentSkills(s.getId())));
    }

    @PutMapping("/students/{studentId}")
    @Transactional
    public ResponseEntity<?> saveStudentSkills(@PathVariable Long studentId, @RequestBody SkillsBody body, Authentication auth) {
        Coordinator c = current(auth);
        if (c == null) return noProfile();
        Student s = students.findById(studentId).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();
        if (!s.getCoordinator().getId().equals(c.getId())) return ResponseEntity.status(403).body("You can only edit your own students.");
        List<String> raw = body == null || body.skills() == null ? List.of() : body.skills();
        String error = SkillService.validate(raw);
        if (error != null) return ResponseEntity.badRequest().body(error);
        return ResponseEntity.ok(new SkillsBody(skillService.setStudentSkills(s, raw)));
    }

    // ---- Skills manager ----

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> catalog(Authentication auth) {
        Coordinator c = current(auth);
        if (c == null) return noProfile();
        return ResponseEntity.ok(new CatalogResponse(isAdmin(c), skillService.catalog()));
    }

    @PatchMapping("/{id}")
    @Transactional
    public ResponseEntity<?> rename(@PathVariable Long id, @RequestBody RenameBody body, Authentication auth) {
        return adminOnly(auth, () -> skillService.rename(id, body == null ? null : body.name()));
    }

    @PostMapping("/{id}/merge")
    @Transactional
    public ResponseEntity<?> merge(@PathVariable Long id, @RequestBody MergeBody body, Authentication auth) {
        if (body == null || body.targetId() == null) return ResponseEntity.badRequest().body("Choose the skill to merge into.");
        return adminOnly(auth, () -> skillService.merge(id, body.targetId()));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> delete(@PathVariable Long id, Authentication auth) {
        return adminOnly(auth, () -> skillService.deleteUnused(id));
    }

    // ---------------------------------------------------------------------

    private ResponseEntity<?> adminOnly(Authentication auth, Runnable action) {
        Coordinator c = current(auth);
        if (c == null) return noProfile();
        if (!isAdmin(c)) return ResponseEntity.status(403).body("Only admin coordinators can change the skills list.");
        try {
            action.run();
            return ResponseEntity.ok().build();
        } catch (ActionException e) {
            return e.toResponse();
        }
    }

    private static boolean isAdmin(Coordinator c) {
        return c.getType() == CoordinatorType.ADMIN;
    }

    private Coordinator current(Authentication auth) {
        return coordinators.findByUserEmail(auth.getName()).orElse(null);
    }

    private static ResponseEntity<?> noProfile() {
        return ResponseEntity.status(403).body("Coordinator profile not found.");
    }
}
