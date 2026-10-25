package com.iodev.practicum.service;

import com.iodev.practicum.model.Announcement;
import com.iodev.practicum.model.AnnouncementFile;
import com.iodev.practicum.repository.AnnouncementFileRepository;
import com.iodev.practicum.storage.FileStorageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** Mga attachment ng announcement: PDF at larawan lang. Ang coordinator lang ang nag-a-upload. */
@Service
public class AnnouncementFileService {

    public static final int MAX_FILES = 5;
    public static final long MAX_SIZE = 10L * 1024 * 1024;
    private static final Set<String> ALLOWED = Set.of("pdf", "png", "jpg", "jpeg", "gif", "webp");

    public record FileItem(Long id, String name, String contentType, long size, String uploadedAt) {}

    @Autowired private FileStorageService storage;
    @Autowired private AnnouncementFileRepository files;

    /** Mensahe ng problema, o null kung tama ang lahat. */
    public String validate(List<MultipartFile> incoming, long existing) {
        if (existing + incoming.size() > MAX_FILES) {
            return "An announcement can have up to " + MAX_FILES + " files.";
        }
        for (MultipartFile f : incoming) {
            String name = FileStorageService.cleanName(f.getOriginalFilename());
            String ext = FileStorageService.extensionOf(name);
            if (!ALLOWED.contains(ext)) return name + ": only PDF and image files are allowed.";
            if (f.isEmpty()) return name + " is empty.";
            if (f.getSize() > MAX_SIZE) return name + " is larger than 10 MB.";
            try {
                if (!signatureOk(ext, header(f))) return name + " doesn't look like a valid ." + ext + " file.";
            } catch (IOException e) {
                return name + " couldn't be read.";
            }
        }
        return null;
    }

    /** Isinusulat ang mga file; kapag pumalya ang isa, binubura ang mga naisulat na. */
    public List<AnnouncementFile> store(Announcement a, List<MultipartFile> incoming) throws IOException {
        List<FileStorageService.StoredFile> written = new ArrayList<>();
        List<AnnouncementFile> saved = new ArrayList<>();
        try {
            for (MultipartFile f : incoming) {
                FileStorageService.StoredFile s = storage.store(f, "announcements/" + a.getId());
                written.add(s);
                AnnouncementFile e = new AnnouncementFile();
                e.setAnnouncement(a);
                e.setFilePath(s.storedName());
                e.setOriginalName(s.originalName());
                e.setContentType(s.contentType());
                e.setFileSize(s.size());
                saved.add(files.save(e));
            }
        } catch (IOException | RuntimeException ex) {
            for (FileStorageService.StoredFile s : written) storage.delete(s.storedName());
            throw ex;
        }
        return saved;
    }

    public void delete(AnnouncementFile f) {
        storage.delete(f.getFilePath());
        files.delete(f);
    }

    public void deleteAllOf(Long announcementId) {
        for (AnnouncementFile f : files.findByAnnouncementIdOrderByIdAsc(announcementId)) delete(f);
    }

    public FileItem item(AnnouncementFile f) {
        String path = f.getFilePath() == null ? "" : f.getFilePath();
        String name = f.getOriginalName() != null ? f.getOriginalName() : path.substring(path.lastIndexOf('/') + 1);
        String type = f.getContentType() != null ? f.getContentType() : storage.contentTypeFor(name);
        return new FileItem(f.getId(), name, type, f.getFileSize() == null ? 0 : f.getFileSize(),
                f.getCreatedAt() == null ? "" : f.getCreatedAt().toInstant().toString());
    }

    public ResponseEntity<?> download(AnnouncementFile f) {
        Path path = storage.resolve(f.getFilePath());
        if (path == null || !Files.isRegularFile(path)) {
            return ResponseEntity.status(404).body("The file is missing on the server.");
        }
        FileItem item = item(f);
        ContentDisposition disposition = ContentDisposition.inline()
                .filename(item.name(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.parseMediaType(item.contentType()))
                .contentLength(path.toFile().length())
                .body(new FileSystemResource(path));
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
            case "pdf" -> new String(h, StandardCharsets.ISO_8859_1).contains("%PDF-");
            case "png" -> n >= 8 && (h[0] & 0xFF) == 0x89 && h[1] == 'P' && h[2] == 'N' && h[3] == 'G';
            case "jpg", "jpeg" -> n >= 3 && (h[0] & 0xFF) == 0xFF && (h[1] & 0xFF) == 0xD8 && (h[2] & 0xFF) == 0xFF;
            case "gif" -> n >= 4 && h[0] == 'G' && h[1] == 'I' && h[2] == 'F' && h[3] == '8';
            case "webp" -> n >= 12 && h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F'
                    && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P';
            default -> false;
        };
    }
}
