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

import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;

/**
 * Upload / download ng mga file ng student sa S3.
 * Ginagamit ang parehong app.s3.bucket at app.s3.region sa application.properties.
 */
@Service
public class RequirementStorage {

    @Value("${app.s3.bucket:}")
    private String bucket;

    @Value("${app.s3.region:ap-southeast-1}")
    private String region;

    private S3Client client;
    private S3Presigner presigner;

    public boolean configured() {
        return bucket != null && !bucket.isBlank();
    }

    private void requireConfigured() {
        if (!configured()) {
            throw new IllegalStateException("File storage isn't set up yet. Add app.s3.bucket to application.properties.");
        }
    }

    public void put(String key, InputStream in, long size, String contentType) throws IOException {
        requireConfigured();
        PutObjectRequest req = PutObjectRequest.builder()
                .bucket(bucket).key(key)
                .contentType(contentType == null || contentType.isBlank() ? "application/octet-stream" : contentType)
                .build();
        client().putObject(req, RequestBody.fromInputStream(in, size));
    }

    public void delete(String key) {
        if (!configured() || key == null || key.isBlank()) return;
        client().deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
    }

    /** Buksan ang isang file para i-stream (hal. sa coordinator na may sariling login, hindi sa S3 mismo) */
    public ResponseInputStream<GetObjectResponse> open(String key) {
        requireConfigured();
        return client().getObject(GetObjectRequest.builder().bucket(bucket).key(key).build());
    }

    public String presignGet(String key, Duration validFor) {
        requireConfigured();
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
