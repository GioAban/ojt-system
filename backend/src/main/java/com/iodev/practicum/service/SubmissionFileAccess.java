package com.iodev.practicum.service;

import com.iodev.practicum.dto.SubmissionDtos.SubmissionFileDto;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.model.SubmissionFile;
import com.iodev.practicum.repository.StudentRepository;
import com.iodev.practicum.repository.SubmissionFileRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Ang lahat ng file at link na inilagay ng student (submission_files), para makita ng coordinator.
 * Ang id na ibinabalik sa listahan ay NEGATIBO (-id ng submission_files) para hindi ito
 * mapagkamalang attachment id ng lumang sistema. Ang /file endpoint ay tumatanggap ng negatibong id.
 */
@Service
public class SubmissionFileAccess {

    @Autowired private SubmissionFileRepository fileRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private RequirementStorage storage;

    /** scope = requirement | weekly | dtr */
    public List<SubmissionFileDto> list(Long studentId, String scope, Long refId) {
        List<SubmissionFileDto> out = new ArrayList<>();
        for (SubmissionFile f : fileRepository.findByStudentIdAndScopeAndRefIdOrderByIdAsc(studentId, scope, refId)) {
            boolean link = "LINK".equals(f.getKind());
            out.add(new SubmissionFileDto(-f.getId(), link ? "LINK" : "FILE", f.getName(), link ? f.getPath() : null));
        }
        return out;
    }

    /** Buksan ang file (stream mula sa S3). Tanging coordinator ng student ang pwede. */
    public ResponseEntity<?> open(Long coordinatorId, long fileId, String scope, Long refId) {
        SubmissionFile f = fileRepository.findById(fileId).orElse(null);
        if (f == null || !scope.equals(f.getScope()) || !refId.equals(f.getRefId())) {
            return ResponseEntity.notFound().build();
        }
        Student student = studentRepository.findById(f.getStudentId()).orElse(null);
        if (student == null || student.getCoordinator() == null
                || !student.getCoordinator().getId().equals(coordinatorId)) {
            return ResponseEntity.status(403).body("You can only open your own students' files.");
        }
        if (!"FILE".equals(f.getKind())) {
            return ResponseEntity.badRequest().body("This item is a link.");
        }
        if (!storage.configured()) {
            return ResponseEntity.status(503).body("File storage isn't set up yet.");
        }

        ResponseInputStream<GetObjectResponse> in;
        try {
            in = storage.open(f.getPath());
        } catch (RuntimeException e) {
            org.slf4j.LoggerFactory.getLogger(SubmissionFileAccess.class)
                    .error("Couldn't open S3 object {}", f.getPath(), e);
            return ResponseEntity.status(404).body("File not found in storage.");
        }

        MediaType type = MediaTypeFactory.getMediaType(f.getName()).orElse(MediaType.APPLICATION_OCTET_STREAM);
        ResponseEntity.BodyBuilder ok = ResponseEntity.ok()
                .contentType(type)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline().filename(f.getName(), StandardCharsets.UTF_8).build().toString());
        Long length = in.response().contentLength();
        if (length != null) ok.contentLength(length);
        return ok.body(new InputStreamResource(in));
    }
}
