package com.iodev.practicum.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.UUID;

@Service
public class FileStorageService {

    public static final long MAX_FILE_BYTES = 20L * 1024 * 1024;

    /** Mga pinapayagang uri. Sinadyang wala ang HTML at SVG (may script). */
    private static final Map<String, String> TYPES = Map.ofEntries(
            Map.entry("pdf", "application/pdf"),
            Map.entry("png", "image/png"),
            Map.entry("jpg", "image/jpeg"),
            Map.entry("jpeg", "image/jpeg"),
            Map.entry("gif", "image/gif"),
            Map.entry("webp", "image/webp"),
            Map.entry("doc", "application/msword"),
            Map.entry("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            Map.entry("xls", "application/vnd.ms-excel"),
            Map.entry("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            Map.entry("ppt", "application/vnd.ms-powerpoint"),
            Map.entry("pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
            Map.entry("txt", "text/plain"),
            Map.entry("csv", "text/csv"),
            Map.entry("zip", "application/zip"));

    public record StoredFile(String storedName, String originalName, String contentType, long size) {}

    private final Path root;

    public FileStorageService(@Value("${app.upload-dir:uploads}") String uploadDir) {
        this.root = Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    public static String cleanName(String raw) {
        String name = raw == null ? "file" : raw.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("\\p{Cntrl}", "").trim();
        if (name.isEmpty()) {
            name = "file";
        }
        if (name.length() > 200) {
            String ext = extensionOf(name);
            name = name.substring(0, 190) + (ext.isEmpty() ? "" : "." + ext);
        }
        return name;
    }

    public static String extensionOf(String name) {
        int dot = name.lastIndexOf('.');
        return dot < 0 || dot == name.length() - 1 ? "" : name.substring(dot + 1).toLowerCase();
    }

    public String contentTypeFor(String name) {
        return TYPES.getOrDefault(extensionOf(name), "application/octet-stream");
    }

    /** Ibinabalik ang mensahe ng problema, o null kung tama ang file. */
    public String validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return "One of the files is empty.";
        }
        String name = cleanName(file.getOriginalFilename());
        if (!TYPES.containsKey(extensionOf(name))) {
            return "\"" + name + "\" isn't an allowed file type. "
                    + "Allowed: PDF, images, Word, Excel, PowerPoint, TXT, CSV, ZIP.";
        }
        if (file.getSize() > MAX_FILE_BYTES) {
            return "\"" + name + "\" is larger than 20 MB.";
        }
        return null;
    }

    public StoredFile store(MultipartFile file, String folder) throws IOException {
        String original = cleanName(file.getOriginalFilename());
        String ext = extensionOf(original);
        String stored = folder + "/" + UUID.randomUUID() + "." + ext;

        Path target = root.resolve(stored).normalize();
        if (!target.startsWith(root)) {
            throw new IOException("Invalid storage path.");
        }

        Files.createDirectories(target.getParent());
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        }

        return new StoredFile(stored, original, TYPES.get(ext), file.getSize());
    }

    /** Hinahanap ang file sa loob ng upload folder lang. Null kung wala o labas sa folder. */
    public Path resolve(String stored) {
        if (stored == null || stored.isBlank()) {
            return null;
        }
        String relative = stored.replace('\\', '/');
        if (relative.startsWith("uploads/")) {
            relative = relative.substring("uploads/".length());
        }
        Path path = root.resolve(relative).normalize();
        return path.startsWith(root) ? path : null;
    }

    public void delete(String stored) {
        Path path = resolve(stored);
        if (path == null) {
            return;
        }
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // hindi mabura, laktawan
        }
    }
}