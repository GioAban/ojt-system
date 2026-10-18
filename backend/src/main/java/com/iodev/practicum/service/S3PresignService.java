package com.iodev.practicum.service;

import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.time.Duration;

/**
 * Imbakan ng mga na-scan na file sa AWS S3. Ang bucket ay galing sa application.properties:
 *   app.s3.bucket=ang-pangalan-ng-bucket
 *   app.s3.region=ap-southeast-1
 * Ang credentials ay galing sa default AWS chain (environment variables, ~/.aws/credentials, o IAM role ng EC2).
 */
@Service
public class S3PresignService {

    @Value("${app.s3.bucket:}")
    private String bucket;

    @Value("${app.s3.region:ap-southeast-1}")
    private String region;

    private S3Presigner presigner;

    public boolean configured() {
        return bucket != null && !bucket.isBlank();
    }

    /** Pansamantalang link (10 minuto) para mabuksan ng coordinator ang file */
    public String presignGet(String key, Duration validFor) {
        if (!configured()) {
            throw new IllegalStateException("File storage isn't set up yet. Add app.s3.bucket to application.properties.");
        }
        GetObjectRequest get = GetObjectRequest.builder().bucket(bucket).key(key).build();
        GetObjectPresignRequest request = GetObjectPresignRequest.builder()
                .signatureDuration(validFor)
                .getObjectRequest(get)
                .build();
        return presigner().presignGetObject(request).url().toString();
    }

    private synchronized S3Presigner presigner() {
        if (presigner == null) {
            presigner = S3Presigner.builder().region(Region.of(region)).build();
        }
        return presigner;
    }

    @PreDestroy
    void close() {
        if (presigner != null) presigner.close();
    }
}
