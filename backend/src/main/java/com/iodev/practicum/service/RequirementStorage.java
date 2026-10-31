package com.iodev.practicum.service;

import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;

/**
 * Upload / download ng mga file ng student sa S3.
 * Ginagamit ang parehong app.s3.bucket at app.s3.region sa application.properties.
 *
 * Para sa local na pag-develop (walang AWS credentials): itakda ang app.storage.local-dir
 * (env STORAGE_LOCAL_DIR). Kapag may laman ito, sa folder na iyon isi-save ang mga file at hindi sa S3.
 */
@Service
public class RequirementStorage {

    @Value("${app.s3.bucket:}")
    private String bucket;

    @Value("${app.s3.region:ap-southeast-1}")
    private String region;

    @Value("${app.storage.local-dir:}")
    private String localDir;

    @Value("${jwt.secret}")
    private String secret;

    @Value("${app.public-url:http://localhost:8080}")
    private String publicUrl;

    private S3Client client;
    private S3Presigner presigner;

    /** Ang binuksang file: ang stream at (kung alam) ang haba nito */
    public record Opened(InputStream stream, Long length) {}

    private boolean local() {
        return localDir != null && !localDir.isBlank();
    }

    public boolean configured() {
        return local() || (bucket != null && !bucket.isBlank());
    }

    private Path localPath(String key) throws IOException {
        Path root = Paths.get(localDir).toAbsolutePath().normalize();
        Path target = root.resolve(key).normalize();
        if (!target.startsWith(root)) throw new IOException("Invalid storage path.");
        return target;
    }

    private String sign(String key, long expires) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal((key + "|" + expires).getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Para sa local mode: tama ba ang pirma at hindi pa expired ang link? */
    public boolean validLocalLink(String key, long expires, String signature) {
        if (!local() || key == null || signature == null || expires < System.currentTimeMillis()) return false;
        return MessageDigest.isEqual(
                sign(key, expires).getBytes(StandardCharsets.UTF_8), signature.getBytes(StandardCharsets.UTF_8));
    }

    private void requireConfigured() {
        if (!configured()) {
            throw new IllegalStateException("File storage isn't set up yet. Add app.s3.bucket to application.properties.");
        }
    }

    public void put(String key, InputStream in, long size, String contentType) throws IOException {
        requireConfigured();
        if (local()) {
            Path target = localPath(key);
            Files.createDirectories(target.getParent());
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            return;
        }
        PutObjectRequest req = PutObjectRequest.builder()
                .bucket(bucket).key(key)
                .contentType(contentType == null || contentType.isBlank() ? "application/octet-stream" : contentType)
                .build();
        client().putObject(req, RequestBody.fromInputStream(in, size));
    }

    public void delete(String key) {
        if (!configured() || key == null || key.isBlank()) return;
        if (local()) {
            try { Files.deleteIfExists(localPath(key)); } catch (IOException ignored) { /* hindi kritikal */ }
            return;
        }
        client().deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
    }

    /** Buksan ang isang file para i-stream (hal. sa coordinator na may sariling login, hindi sa S3 mismo) */
    public Opened open(String key) {
        requireConfigured();
        if (local()) {
            try {
                Path path = localPath(key);
                return new Opened(Files.newInputStream(path), Files.size(path));
            } catch (IOException e) {
                throw new IllegalStateException("File not found in local storage.", e);
            }
        }
        ResponseInputStream<GetObjectResponse> in =
                client().getObject(GetObjectRequest.builder().bucket(bucket).key(key).build());
        return new Opened(in, in.response().contentLength());
    }

    public String presignGet(String key, Duration validFor) {
        requireConfigured();
        if (local()) {
            long expires = System.currentTimeMillis() + validFor.toMillis();
            return publicUrl + "/api/public/local-files?key=" + URLEncoder.encode(key, StandardCharsets.UTF_8)
                    + "&exp=" + expires + "&sig=" + sign(key, expires);
        }
        GetObjectRequest get = GetObjectRequest.builder().bucket(bucket).key(key).build();
        return presigner().presignGetObject(GetObjectPresignRequest.builder()
                .signatureDuration(validFor).getObjectRequest(get).build()).url().toString();
    }

    private synchronized S3Client client() {
        if (client == null) client = S3Client.builder().region(Region.of(region)).build();
        return client;
    }

    private synchronized S3Presigner presigner() {
        if (presigner == null) presigner = S3Presigner.builder().region(Region.of(region)).build();
        return presigner;
    }

    @PreDestroy
    void close() {
        if (client != null) client.close();
        if (presigner != null) presigner.close();
    }
}
