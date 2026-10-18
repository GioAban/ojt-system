package com.iodev.practicum.controller;

import com.iodev.practicum.dto.CompanyManagementDtos.MoaFileItem;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.Department;
import com.iodev.practicum.model.DepartmentMoaFile;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.DepartmentMoaFileRepository;
import com.iodev.practicum.repository.DepartmentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/coordinator/companies/departments/{departmentId}/moa-files")
public class MoaFilesController {

    private static final long MAX_SIZE = 20L * 1024 * 1024;
    private static final int MAX_PER_UPLOAD = 10;
    private static final int MAX_PER_DEPARTMENT = 20;

    private static final Map<String, String> TYPES = Map.ofEntries(
            Map.entry("pdf", "application/pdf"),
            Map.entry("jpg", "image/jpeg"),
            Map.entry("jpeg", "image/jpeg"),
            Map.entry("png", "image/png"),
            Map.entry("gif", "image/gif"),
            Map.entry("webp", "image/webp"),
            Map.entry("doc", "application/msword"),
            Map.entry("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"));

    @Value("${app.upload-dir:uploads}")
    private String uploadDir;

    @Autowired private CoordinatorRepository coordinatorRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private DepartmentMoaFileRepository fileRepository;

    private record Access(Department department, ResponseEntity<?> error) {}
    private record Pending(MultipartFile file, String name, String ext, String type) {}

    // ---------------------------------------------------------------------
    // Upload (maraming file)
    // ---------------------------------------------------------------------

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public ResponseEntity<?> upload(@PathVariable Long departmentId,
                                    @RequestParam("files") List<MultipartFile> files,
                                    Authentication authentication) {
        Access access = access(departmentId, authentication);
        if (access.error() != null) return access.error();
        Department department = access.department();

        if (Boolean.TRUE.equals(department.getIsArchived())
                || Boolean.TRUE.equals(department.getCompany().getIsArchived())) {
            return bad("Restore the company or department first.");
        }

        List<MultipartFile> incoming = files.stream().filter(f -> !f.isEmpty()).toList();
        if (incoming.isEmpty()) return bad("Choose at least one file.");
        if (incoming.size() > MAX_PER_UPLOAD) {
            return bad("You can upload up to " + MAX_PER_UPLOAD + " files at a time.");
        }

        long existing = fileRepository.countByDepartmentId(departmentId);
        if (existing + incoming.size() > MAX_PER_DEPARTMENT) {
            return bad("A department can have up to " + MAX_PER_DEPARTMENT
                    + " MOA files. This one has " + existing + " now.");
        }

        // Suriin muna ang lahat bago magsulat ng kahit isa
        List<Pending> pending = new ArrayList<>();
        for (MultipartFile f : incoming) {
            String name = displayName(f.getOriginalFilename());
            String ext = extension(name);
            String type = TYPES.get(ext);

            if (type == null) return bad(name + ": only PDF, Word, and image files are allowed.");
            if (f.getSize() > MAX_SIZE) return bad(name + " is larger than 20 MB.");

            try {
                if (!signatureOk(ext, header(f))) {
                    return bad(name + " doesn't look like a valid ." + ext + " file.");
                }
            } catch (IOException e) {
                return bad(name + " couldn't be read.");
            }

            pending.add(new Pending(f, name, ext, type));
        }

        List<Path> written = new ArrayList<>();
        List<DepartmentMoaFile> saved = new ArrayList<>();

        try {
            Path dir = baseDir().resolve("moa").resolve(String.valueOf(departmentId)).normalize();
            Files.createDirectories(dir);

            for (Pending p : pending) {
                String storedName = UUID.randomUUID() + "." + p.ext();
                Path target = dir.resolve(storedName).normalize();
                if (!target.startsWith(dir)) throw new IOException("Invalid path");

                p.file().transferTo(target);
                written.add(target);

                DepartmentMoaFile entity = new DepartmentMoaFile();
                entity.setDepartment(department);
                entity.setOriginalName(p.name());
                entity.setStoredPath("moa/" + departmentId + "/" + storedName);
                entity.setContentType(p.type());
                entity.setFileSize(p.file().getSize());
                entity.setUploadedAt(LocalDateTime.now());
                saved.add(fileRepository.save(entity));
            }
        } catch (IOException | RuntimeException e) {
            for (Path path : written) {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException ignored) {
                    // wala nang magagawa
                }
            }
            if (e instanceof RuntimeException re) throw re;
            return ResponseEntity.status(500).body("Couldn't save the files. Please try again.");
        }

        return ResponseEntity.ok(saved.stream().map(MoaFileItem::from).toList());
    }

    // ---------------------------------------------------------------------
    // Buksan o i-download
    // ---------------------------------------------------------------------

    @GetMapping("/{fileId}/file")
    @Transactional(readOnly = true)
    public ResponseEntity<?> file(@PathVariable Long departmentId,
                                  @PathVariable Long fileId,
                                  Authentication authentication) {
        Access access = access(departmentId, authentication);
        if (access.error() != null) return access.error();

        DepartmentMoaFile f = fileRepository.findByIdAndDepartmentId(fileId, departmentId).orElse(null);
        if (f == null) return ResponseEntity.notFound().build();

        Path path = resolve(f.getStoredPath());
        if (path == null || !Files.isRegularFile(path)) {
            return ResponseEntity.status(404).body("The file is missing on the server.");
        }

        boolean inline = f.getContentType().equals("application/pdf") || f.getContentType().startsWith("image/");
        ContentDisposition disposition = (inline ? ContentDisposition.inline() : ContentDisposition.attachment())
                .filename(f.getOriginalName(), StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.parseMediaType(f.getContentType()))
                .contentLength(path.toFile().length())
                .body(new FileSystemResource(path));
    }

    // ---------------------------------------------------------------------
    // Burahin
    // ---------------------------------------------------------------------

    @DeleteMapping("/{fileId}")
    @Transactional
    public ResponseEntity<?> delete(@PathVariable Long departmentId,
                                    @PathVariable Long fileId,
                                    Authentication authentication) {
        Access access = access(departmentId, authentication);
        if (access.error() != null) return access.error();

        DepartmentMoaFile f = fileRepository.findByIdAndDepartmentId(fileId, departmentId).orElse(null);
        if (f == null) return ResponseEntity.notFound().build();

        Path path = resolve(f.getStoredPath());
        fileRepository.delete(f);

        if (path != null) {
            try {
                Files.deleteIfExists(path);
            } catch (IOException ignored) {
                // nabura na ang record; ang natirang file ay hindi na maaabot
            }
        }

        return ResponseEntity.ok().build();
    }

    // ---------------------------------------------------------------------
    // Mga helper
    // ---------------------------------------------------------------------

    private Access access(Long departmentId, Authentication authentication) {
        Coordinator coordinator = coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
        if (coordinator == null) {
            return new Access(null, ResponseEntity.status(403).body("Coordinator profile not found."));
        }

        Department department = departmentRepository.findById(departmentId).orElse(null);
        if (department == null) return new Access(null, ResponseEntity.notFound().build());

        if (!department.getCompany().getCoordinator().getId().equals(coordinator.getId())) {
            return new Access(null, ResponseEntity.status(403).body("You can only manage your own companies."));
        }
        return new Access(department, null);
    }

    private ResponseEntity<?> bad(String message) {
        return ResponseEntity.badRequest().body(message);
    }

    private Path baseDir() {
        return Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    private Path resolve(String stored) {
        Path base = baseDir();
        Path path = base.resolve(stored).normalize();
        return path.startsWith(base) ? path : null;
    }

    private String displayName(String raw) {
        String name = raw == null ? "" : raw.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("\\p{Cntrl}", "").trim();

        int dot = name.lastIndexOf('.');
        if (name.length() > 200 && dot > 0) {
            name = name.substring(0, Math.min(dot, 190)) + name.substring(dot);
        }
        return name.isEmpty() ? "file" : name;
    }

    private String extension(String name) {
        int dot = name.lastIndexOf('.');
        return dot < 0 ? "" : name.substring(dot + 1).toLowerCase();
    }

    private byte[] header(MultipartFile file) throws IOException {
        try (InputStream in = file.getInputStream()) {
            return in.readNBytes(1024);
        }
    }

    /** Tinitingnan ang simula ng file, hindi lang ang extension */
    private boolean signatureOk(String ext, byte[] h) {
        int n = h.length;

        return switch (ext) {
            case "pdf" -> new String(h, StandardCharsets.ISO_8859_1).contains("%PDF-");
            case "png" -> n >= 8 && (h[0] & 0xFF) == 0x89 && h[1] == 'P' && h[2] == 'N' && h[3] == 'G';
            case "jpg", "jpeg" -> n >= 3 && (h[0] & 0xFF) == 0xFF && (h[1] & 0xFF) == 0xD8 && (h[2] & 0xFF) == 0xFF;
            case "gif" -> n >= 4 && h[0] == 'G' && h[1] == 'I' && h[2] == 'F' && h[3] == '8';
            case "webp" -> n >= 12 && h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F'
                    && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P';
            case "docx" -> n >= 4 && h[0] == 'P' && h[1] == 'K' && h[2] == 3 && h[3] == 4;
            case "doc" -> n >= 4 && (h[0] & 0xFF) == 0xD0 && (h[1] & 0xFF) == 0xCF
                    && (h[2] & 0xFF) == 0x11 && (h[3] & 0xFF) == 0xE0;
            default -> false;
        };
    }
}