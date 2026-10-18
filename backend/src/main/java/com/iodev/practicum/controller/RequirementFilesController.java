package com.iodev.practicum.controller;

import com.iodev.practicum.dto.SubmissionDtos.*;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.DocumentRequirement;
import com.iodev.practicum.model.DocumentRequirementAttachment;
import com.iodev.practicum.model.RequirementMaterial;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.DocumentRequirementAttachmentRepository;
import com.iodev.practicum.repository.DocumentRequirementRepository;
import com.iodev.practicum.repository.RequirementMaterialRepository;
import com.iodev.practicum.repository.StudentRepository;
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
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/coordinator/requirements")
public class RequirementFilesController {

    private static final int MAX_FILES_PER_UPLOAD = 10;
    private static final int MAX_MATERIALS = 20;
    private static final Pattern URL_PATTERN = Pattern.compile("^https?://\\S+$", Pattern.CASE_INSENSITIVE);

    @Autowired
    private CoordinatorRepository coordinatorRepository;

    @Autowired
    private DocumentRequirementRepository requirementRepository;

    @Autowired
    private RequirementMaterialRepository materialRepository;

    @Autowired
    private DocumentRequirementAttachmentRepository attachmentRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private FileStorageService storage;

    @Autowired
    private SubmissionFileAccess studentFiles;

    private record Lookup(DocumentRequirement requirement, Coordinator coordinator, ResponseEntity<?> error) {}

    private Lookup lookup(Long id, Authentication authentication) {
        Coordinator coordinator = coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
        if (coordinator == null) {
            return new Lookup(null, null, ResponseEntity.status(403).body("Coordinator profile not found."));
        }

        DocumentRequirement requirement = requirementRepository.findById(id).orElse(null);
        if (requirement == null) {
            return new Lookup(null, coordinator, ResponseEntity.notFound().build());
        }
        if (!requirement.getCoordinator().getId().equals(coordinator.getId())) {
            return new Lookup(null, coordinator,
                    ResponseEntity.status(403).body("You can only manage your own requirements."));
        }
        return new Lookup(requirement, coordinator, null);
    }

    // =====================================================================
    // Attachments ng coordinator
    // =====================================================================

    @GetMapping("/{id}/materials")
    @Transactional(readOnly = true)
    public ResponseEntity<?> materials(@PathVariable Long id, Authentication authentication) {
        Lookup l = lookup(id, authentication);
        if (l.error() != null) return l.error();

        return ResponseEntity.ok(materialRepository.findByRequirementIdOrderByIdAsc(id).stream()
                .map(this::toDto)
                .toList());
    }

    @PostMapping(value = "/{id}/materials", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public ResponseEntity<?> upload(@PathVariable Long id,
                                    @RequestParam("files") List<MultipartFile> files,
                                    Authentication authentication) {
        Lookup l = lookup(id, authentication);
        if (l.error() != null) return l.error();

        if (files == null || files.isEmpty()) {
            return ResponseEntity.badRequest().body("Please choose at least one file.");
        }
        if (files.size() > MAX_FILES_PER_UPLOAD) {
            return ResponseEntity.badRequest().body("You can upload up to " + MAX_FILES_PER_UPLOAD + " files at a time.");
        }

        for (MultipartFile file : files) {
            String problem = storage.validate(file);
            if (problem != null) {
                return ResponseEntity.badRequest().body(problem);
            }
        }

        long existing = materialRepository.countByRequirementId(id);
        if (existing + files.size() > MAX_MATERIALS) {
            return ResponseEntity.badRequest().body("A requirement can have up to " + MAX_MATERIALS + " attachments.");
        }

        List<FileStorageService.StoredFile> stored = new ArrayList<>();
        try {
            for (MultipartFile file : files) {
                stored.add(storage.store(file, "requirements/" + id));
            }
        } catch (IOException e) {
            stored.forEach(s -> storage.delete(s.storedName()));
            return ResponseEntity.status(500).body("Couldn't save the files. Please try again.");
        }

        try {
            List<MaterialDto> created = new ArrayList<>();
            for (FileStorageService.StoredFile s : stored) {
                RequirementMaterial material = new RequirementMaterial();
                material.setRequirement(l.requirement());
                material.setKind("FILE");
                material.setName(s.originalName());
                material.setStoredName(s.storedName());
                material.setContentType(s.contentType());
                material.setSizeBytes(s.size());
                created.add(toDto(materialRepository.save(material)));
            }
            return ResponseEntity.ok(created);
        } catch (RuntimeException e) {
            stored.forEach(s -> storage.delete(s.storedName()));
            throw e;
        }
    }

    @PostMapping("/{id}/materials/link")
    @Transactional
    public ResponseEntity<?> addLink(@PathVariable Long id,
                                     @RequestBody LinkRequest request,
                                     Authentication authentication) {
        Lookup l = lookup(id, authentication);
        if (l.error() != null) return l.error();

        String url = request == null || request.url() == null ? "" : request.url().trim();
        if (url.length() > 2048 || !URL_PATTERN.matcher(url).matches()) {
            return ResponseEntity.badRequest().body("Enter a valid link that starts with http:// or https://");
        }
        if (materialRepository.countByRequirementId(id) >= MAX_MATERIALS) {
            return ResponseEntity.badRequest().body("A requirement can have up to " + MAX_MATERIALS + " attachments.");
        }

        String name = request.name() == null ? "" : request.name().trim();
        if (name.length() > 255) {
            return ResponseEntity.badRequest().body("The link name is too long (max 255 characters).");
        }
        if (name.isEmpty()) {
            name = hostOf(url);
        }

        RequirementMaterial material = new RequirementMaterial();
        material.setRequirement(l.requirement());
        material.setKind("LINK");
        material.setName(name);
        material.setUrl(url);

        return ResponseEntity.ok(toDto(materialRepository.save(material)));
    }

    @DeleteMapping("/{id}/materials/{materialId}")
    @Transactional
    public ResponseEntity<?> deleteMaterial(@PathVariable Long id,
                                            @PathVariable Long materialId,
                                            Authentication authentication) {
        Lookup l = lookup(id, authentication);
        if (l.error() != null) return l.error();

        RequirementMaterial material = materialRepository.findByIdAndRequirementId(materialId, id).orElse(null);
        if (material == null) {
            return ResponseEntity.notFound().build();
        }

        if ("FILE".equals(material.getKind())) {
            storage.delete(material.getStoredName());
        }
        materialRepository.delete(material);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}/materials/{materialId}/file")
    @Transactional(readOnly = true)
    public ResponseEntity<?> materialFile(@PathVariable Long id,
                                          @PathVariable Long materialId,
                                          Authentication authentication) {
        Lookup l = lookup(id, authentication);
        if (l.error() != null) return l.error();

        RequirementMaterial material = materialRepository.findByIdAndRequirementId(materialId, id).orElse(null);
        if (material == null) {
            return ResponseEntity.notFound().build();
        }
        if (!"FILE".equals(material.getKind())) {
            return ResponseEntity.badRequest().body("This attachment is a link.");
        }

        return fileResponse(material.getStoredName(), material.getName(), material.getContentType());
    }

    // =====================================================================
    // Student work
    // =====================================================================

    @GetMapping("/{id}/submissions")
    @Transactional(readOnly = true)
    public ResponseEntity<?> submissions(@PathVariable Long id, Authentication authentication) {
        Lookup l = lookup(id, authentication);
        if (l.error() != null) return l.error();

        DocumentRequirement requirement = l.requirement();
        List<Student> students =
                studentRepository.findForTracking(l.coordinator().getId(), requirement.getSemester().getId());

        Map<Long, List<DocumentRequirementAttachment>> byStudent = new HashMap<>();
        for (DocumentRequirementAttachment a : attachmentRepository.findForSubmissions(id)) {
            byStudent.computeIfAbsent(a.getStudent().getId(), k -> new ArrayList<>()).add(a);
        }

        List<SubmissionStudentDto> rows = new ArrayList<>();
        for (Student s : students) {
            List<DocumentRequirementAttachment> items = byStudent.getOrDefault(s.getId(), List.of());

            String status = "ASSIGNED";
            List<SubmissionFileDto> files = new ArrayList<>();
            for (DocumentRequirementAttachment a : items) {
                status = strongest(status, normalize(a.getStatus()));

                String path = a.getFilePath();
                if (path != null && !path.isBlank()) {
                    boolean link = isLink(path);
                    files.add(new SubmissionFileDto(a.getId(), link ? "LINK" : "FILE",
                            link ? path : displayName(path), link ? path : null));
                }
            }

            // Ang mga file at link na inilagay ng student sa bagong page niya ang pangunahin
            List<SubmissionFileDto> own = studentFiles.list(s.getId(), "requirement", id);
            if (!own.isEmpty()) files = own;

            rows.add(new SubmissionStudentDto(s.getId(), s.getStudentNumber(), s.getFirstname(),
                    s.getLastname(), s.getMiddleInitial(), status, files));
        }

        List<MaterialDto> materials = materialRepository.findByRequirementIdOrderByIdAsc(id).stream()
                .map(this::toDto)
                .toList();

        return ResponseEntity.ok(new SubmissionsResponse(
                requirement.getId(), requirement.getTitle(), requirement.getInstructions(),
                requirement.getDueDate(), Boolean.TRUE.equals(requirement.getIsArchived()),
                requirement.getType(), materials, rows));
    }

    @GetMapping("/{id}/submissions/{attachmentId}/file")
    @Transactional(readOnly = true)
    public ResponseEntity<?> submissionFile(@PathVariable Long id,
                                            @PathVariable Long attachmentId,
                                            Authentication authentication) {
        Lookup l = lookup(id, authentication);
        if (l.error() != null) return l.error();

        // Negatibong id = file na inilagay ng student (submission_files)
        if (attachmentId < 0) return studentFiles.open(l.coordinator().getId(), -attachmentId, "requirement", id);

        DocumentRequirementAttachment attachment = attachmentRepository.findById(attachmentId).orElse(null);
        if (attachment == null || !attachment.getDocumentRequirement().getId().equals(id)) {
            return ResponseEntity.notFound().build();
        }
        if (!attachment.getStudent().getCoordinator().getId().equals(l.coordinator().getId())) {
            return ResponseEntity.status(403).body("You can only open your own students' files.");
        }

        String path = attachment.getFilePath();
        if (path == null || path.isBlank() || isLink(path)) {
            return ResponseEntity.badRequest().body("This submission has no file to open.");
        }

        return fileResponse(path, displayName(path), null);
    }

    // =====================================================================
    // Mga helper
    // =====================================================================

    private ResponseEntity<?> fileResponse(String stored, String name, String contentType) {
        Path path = storage.resolve(stored);
        if (path == null || !Files.isRegularFile(path)) {
            return ResponseEntity.status(404).body("File not found on the server.");
        }

        MediaType type;
        try {
            type = MediaType.parseMediaType(contentType == null ? storage.contentTypeFor(name) : contentType);
        } catch (RuntimeException e) {
            type = MediaType.APPLICATION_OCTET_STREAM;
        }

        return ResponseEntity.ok()
                .contentType(type)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline().filename(name, StandardCharsets.UTF_8).build().toString())
                .body(new FileSystemResource(path));
    }

    private MaterialDto toDto(RequirementMaterial m) {
        return new MaterialDto(m.getId(), m.getKind(), m.getName(), m.getUrl(), m.getSizeBytes(), m.getContentType());
    }

    private static boolean isLink(String path) {
        return path.regionMatches(true, 0, "http://", 0, 7) || path.regionMatches(true, 0, "https://", 0, 8);
    }

    private static String displayName(String path) {
        String normalized = path.replace('\\', '/');
        return normalized.substring(normalized.lastIndexOf('/') + 1);
    }

    private static String hostOf(String url) {
        try {
            String host = URI.create(url).getHost();
            return host == null || host.isBlank() ? url : host;
        } catch (RuntimeException e) {
            return url;
        }
    }

    private static String normalize(String raw) {
        if (raw == null) return "ASSIGNED";
        return switch (raw.trim().toLowerCase().replace('_', ' ')) {
            case "checked" -> "CHECKED";
            case "for checking" -> "FOR_CHECKING";
            case "invalid" -> "INVALID";
            default -> "ASSIGNED";
        };
    }

    private static int rank(String status) {
        return switch (status) {
            case "INVALID" -> 3;
            case "FOR_CHECKING" -> 2;
            case "CHECKED" -> 1;
            default -> 0;
        };
    }

    private static String strongest(String a, String b) {
        return rank(a) >= rank(b) ? a : b;
    }
}