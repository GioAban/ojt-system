package com.iodev.practicum.controller;

import com.iodev.practicum.dto.CollegeResponse;
import com.iodev.practicum.model.College;
import com.iodev.practicum.repository.CollegeRepository;
import com.iodev.practicum.repository.ProgramRepository;
import com.iodev.practicum.storage.FileStorageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Set;

/**
 * Logo ng college: ina-upload ng admin, at ginagamit sa mga report (hal. Weekly Report).
 * Pampubliko ang pagkuha ng larawan (hindi sensitibo) para gumana ito sa <img>, print at PDF.
 */
@RestController
@RequestMapping("/api")
public class CollegeLogoController {

    private static final long MAX_SIZE = 2L * 1024 * 1024;
    private static final Set<String> ALLOWED = Set.of("png", "jpg", "jpeg", "webp");

    @Autowired private CollegeRepository colleges;
    @Autowired private ProgramRepository programs;
    @Autowired private FileStorageService storage;

    @PostMapping("/colleges/{id}/logo")
    @Transactional
    public ResponseEntity<?> upload(@PathVariable Long id, @RequestParam("file") MultipartFile file) {
        College college = colleges.findById(id).orElse(null);
        if (college == null) return ResponseEntity.notFound().build();
        if (file == null || file.isEmpty()) return ResponseEntity.badRequest().body("Choose an image first.");
        if (file.getSize() > MAX_SIZE) return ResponseEntity.badRequest().body("The logo is larger than 2 MB.");

        String name = FileStorageService.cleanName(file.getOriginalFilename());
        String ext = FileStorageService.extensionOf(name);
        if (!ALLOWED.contains(ext)) return ResponseEntity.badRequest().body("Use a PNG, JPG or WebP image.");
        try {
            if (!signatureOk(ext, header(file))) {
                return ResponseEntity.badRequest().body("That doesn't look like a valid ." + ext + " image.");
            }
        } catch (IOException e) {
            return ResponseEntity.badRequest().body("The image couldn't be read.");
        }

        String previous = college.getLogo();
        FileStorageService.StoredFile stored;
        try {
            stored = storage.store(file, "college-logos/" + id);
        } catch (IOException | RuntimeException e) {
            return ResponseEntity.status(502).body("The upload failed. Please try again.");
        }
        college.setLogo(stored.storedName());
        College saved = colleges.saveAndFlush(college);
        if (previous != null && !previous.isBlank()) {
            try { storage.delete(previous); } catch (RuntimeException ignored) { /* hindi kritikal */ }
        }
        return ResponseEntity.ok(toResponse(saved));
    }

    @DeleteMapping("/colleges/{id}/logo")
    @Transactional
    public ResponseEntity<?> remove(@PathVariable Long id) {
        College college = colleges.findById(id).orElse(null);
        if (college == null) return ResponseEntity.notFound().build();
        String previous = college.getLogo();
        college.setLogo(null);
        College saved = colleges.saveAndFlush(college);
        if (previous != null && !previous.isBlank()) {
            try { storage.delete(previous); } catch (RuntimeException ignored) { /* hindi kritikal */ }
        }
        return ResponseEntity.ok(toResponse(saved));
    }

    /** Pampubliko: ang larawan mismo. Ang ?v= sa URL ang nagpapalit ng cache kapag napalitan ang logo. */
    @GetMapping("/public/colleges/{id}/logo")
    @Transactional(readOnly = true)
    public ResponseEntity<?> logo(@PathVariable Long id) {
        College college = colleges.findById(id).orElse(null);
        if (college == null || college.getLogo() == null || college.getLogo().isBlank()) {
            return ResponseEntity.notFound().build();
        }
        Path path = storage.resolve(college.getLogo());
        if (path == null || !Files.isRegularFile(path)) return ResponseEntity.notFound().build();
        return ResponseEntity.ok()
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .cacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePublic())
                .contentType(MediaType.parseMediaType(storage.contentTypeFor(college.getLogo())))
                .contentLength(path.toFile().length())
                .body(new FileSystemResource(path));
    }

    private CollegeResponse toResponse(College c) {
        return CollegeController.response(c, programs.countActiveByCollegeId(c.getId()));
    }

    private static byte[] header(MultipartFile file) throws IOException {
        try (InputStream in = file.getInputStream()) {
            return in.readNBytes(1024);
        }
    }

    /** Tinitingnan ang simula ng file, hindi lang ang extension */
    private static boolean signatureOk(String ext, byte[] h) {
        int n = h.length;
        return switch (ext) {
            case "png" -> n >= 8 && (h[0] & 0xFF) == 0x89 && h[1] == 'P' && h[2] == 'N' && h[3] == 'G';
            case "jpg", "jpeg" -> n >= 3 && (h[0] & 0xFF) == 0xFF && (h[1] & 0xFF) == 0xD8 && (h[2] & 0xFF) == 0xFF;
            case "webp" -> n >= 12 && h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F'
                    && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P';
            default -> false;
        };
    }
}
