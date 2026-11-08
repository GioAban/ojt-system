package com.iodev.practicum.service;

import com.iodev.practicum.dto.EvaluationDtos.CriterionScore;
import com.iodev.practicum.dto.EvaluationDtos.Form;
import com.iodev.practicum.dto.EvaluationDtos.FormUpdate;
import com.iodev.practicum.dto.EvaluationDtos.Info;
import com.iodev.practicum.model.Department;
import com.iodev.practicum.model.Evaluation;
import com.iodev.practicum.model.EvaluationCriteria;
import com.iodev.practicum.model.SignedEvaluation;
import com.iodev.practicum.model.SignedEvaluationCriteriaScore;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.model.SubmissionFile;
import com.iodev.practicum.repository.EvaluationCriteriaRepository;
import com.iodev.practicum.repository.EvaluationRepository;
import com.iodev.practicum.repository.SignedEvaluationCriteriaScoreRepository;
import com.iodev.practicum.repository.SignedEvaluationRepository;
import com.iodev.practicum.repository.SubmissionFileRepository;
import com.iodev.practicum.util.EvaluationAccess;
import com.iodev.practicum.util.EvaluationForms;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Ang form ng Midterm at Final Evaluation ng isang student.
 * Dito ang mga score at ang teksto; ang status, signed copy at comments ay nasa requirement machinery pa rin.
 * Ang kabuuan ay laging kinukuwenta rito at hindi tinatanggap mula sa browser.
 */
@Service
public class EvaluationFormService {

    private static final String DEFAULT_POSITION = "Instructor / OJT Supervisor";
    private static final Set<String> SIGNED_COPY_TYPES = Set.of("pdf", "png", "jpg", "jpeg", "webp");
    private static final int MAX_TEXT = 5000;
    private static final int MAX_FIELD = 255;

    @Autowired private EvaluationRepository evaluationRepository;
    @Autowired private EvaluationCriteriaRepository criteriaRepository;
    @Autowired private SignedEvaluationRepository signedRepository;
    @Autowired private SignedEvaluationCriteriaScoreRepository scoreRepository;
    @Autowired private SubmissionFileRepository fileRepository;

    public Evaluation evaluationFor(Long requirementId) {
        return evaluationRepository.findByRequirementId(requirementId).orElse(null);
    }

    public static boolean isSignedCopyName(String name) {
        if (name == null) return false;
        int dot = name.lastIndexOf('.');
        return dot >= 0 && SIGNED_COPY_TYPES.contains(name.substring(dot + 1).toLowerCase(Locale.ROOT));
    }

    public Form view(Evaluation evaluation, Student s, boolean editable) {
        String key = evaluation.getRequirement().getSystemKey();
        SignedEvaluation signed = signedRepository.findByEvaluationIdAndStudentId(evaluation.getId(), s.getId()).orElse(null);
        Map<Long, BigDecimal> scores = new HashMap<>();
        if (signed != null) {
            for (SignedEvaluationCriteriaScore row : scoreRepository.findBySignedEvaluationId(signed.getId())) {
                if (row.getScore() != null) scores.put(row.getEvaluationCriteria().getId(), row.getScore());
            }
        }

        List<CriterionScore> criteria = new ArrayList<>();
        for (EvaluationCriteria c : criteriaRepository.findForForm(evaluation.getId())) {
            criteria.add(new CriterionScore(c.getId(), c.getCategory(), c.getName(), c.getWeight(), scores.get(c.getId())));
        }

        Info info = info(s);
        if (signed == null) {
            SupervisorResolver.Supervisor sup = SupervisorResolver.forStudent(s);
            String position = sup.positionOrNull();
            if ((position == null || position.isBlank()) && EvaluationAccess.FINAL.equals(key)) position = DEFAULT_POSITION;
            String from = dateOnly(s.getStartTrainingDate() != null && !s.getStartTrainingDate().isBlank()
                    ? s.getStartTrainingDate() : s.getDeployedDate());
            return new Form(key, info, criteria, null, null, false,
                    sup.nameOrNull(), position, null,
                    from, dateOnly(s.getCompletedDate()), s.getContact(),
                    BigDecimal.ZERO, BigDecimal.ZERO, null, null, editable);
        }
        return new Form(key, info, criteria, signed.getStrongPoints(), signed.getNeedsImprovement(),
                Boolean.TRUE.equals(signed.getIsDiscussed()),
                signed.getSupervisorName(), signed.getSupervisorPosition(),
                signed.getSignedDate() == null ? null : signed.getSignedDate().toLocalDateTime().toLocalDate().toString(),
                signed.getPeriodFrom() == null ? null : signed.getPeriodFrom().toString(),
                signed.getPeriodTo() == null ? null : signed.getPeriodTo().toString(),
                signed.getContactNo(), signed.getOriginalScore(), signed.getNormalizedScore(),
                signed.getEditedByName(),
                signed.getEditedAt() == null ? null : signed.getEditedAt().toInstant().toString(),
                editable);
    }

    /** Sine-save ang buong form. IllegalArgumentException kapag may maling laman; walang nababago sa ganoon. */
    public void save(Evaluation evaluation, Student s, FormUpdate update) {
        if (update == null) throw new IllegalArgumentException("Request body is required.");
        String key = evaluation.getRequirement().getSystemKey();
        List<EvaluationCriteria> criteria = criteriaRepository.findForForm(evaluation.getId());
        Map<Long, BigDecimal> incoming = update.scores() == null ? Map.of() : update.scores();

        // Sinusuri muna lahat bago may galawin
        Set<Long> known = new java.util.HashSet<>();
        for (EvaluationCriteria c : criteria) known.add(c.getId());
        for (Map.Entry<Long, BigDecimal> e : incoming.entrySet()) {
            if (!known.contains(e.getKey())) throw new IllegalArgumentException("Unknown criterion.");
            if (e.getValue() != null && !EvaluationForms.validScore(key, e.getValue())) {
                throw new IllegalArgumentException(EvaluationAccess.MIDTERM.equals(key)
                        ? "Each rating must be from 1 to 5."
                        : "Each grade must be from 0 to 100, with up to 2 decimals.");
            }
        }
        String strong = text(update.strongPoints(), MAX_TEXT, "Strong points");
        String improve = text(update.needsImprovement(), MAX_TEXT, "Areas that need improvement");
        String name = text(update.supervisorName(), MAX_FIELD, "Supervisor name");
        String position = text(update.supervisorPosition(), MAX_FIELD, "Supervisor position");
        String contact = text(update.contactNo(), MAX_FIELD, "Contact number");
        LocalDate date = parseDate(update.date());
        LocalDate from = parseDate(update.periodFrom());
        LocalDate to = parseDate(update.periodTo());
        if (from != null && to != null && to.isBefore(from)) {
            throw new IllegalArgumentException("The end of the training period can't be before the start.");
        }

        SignedEvaluation signed = signedRepository.findByEvaluationIdAndStudentId(evaluation.getId(), s.getId()).orElse(null);
        if (signed == null) {
            signed = new SignedEvaluation();
            signed.setEvaluation(evaluation);
            signed.setStudent(s);
            // Hindi pwedeng walang laman ang mga column na ito; ang file ay nasa submission_files
            signed.setSignedFile("");
            signed.setOriginalScore(BigDecimal.ZERO);
            signed.setNormalizedScore(BigDecimal.ZERO);
            signed = signedRepository.save(signed);
        }

        Map<Long, SignedEvaluationCriteriaScore> rows = new HashMap<>();
        for (SignedEvaluationCriteriaScore row : scoreRepository.findBySignedEvaluationId(signed.getId())) {
            rows.put(row.getEvaluationCriteria().getId(), row);
        }
        BigDecimal total = BigDecimal.ZERO;
        List<SignedEvaluationCriteriaScore> toSave = new ArrayList<>();
        for (EvaluationCriteria c : criteria) {
            BigDecimal score = incoming.get(c.getId());
            SignedEvaluationCriteriaScore row = rows.get(c.getId());
            if (row == null && score == null) continue;
            if (row == null) {
                row = new SignedEvaluationCriteriaScore();
                row.setSignedEvaluation(signed);
                row.setEvaluationCriteria(c);
            }
            row.setScore(score);
            toSave.add(row);
            if (score != null) total = total.add(EvaluationForms.points(score, c.getWeight()));
        }
        scoreRepository.saveAll(toSave);

        signed.setOriginalScore(total.setScale(2, java.math.RoundingMode.HALF_UP));
        signed.setNormalizedScore(EvaluationForms.normalized(key, total, criteria.size()));
        signed.setStrongPoints(strong);
        signed.setNeedsImprovement(improve);
        signed.setIsDiscussed(Boolean.TRUE.equals(update.discussed()));
        signed.setSupervisorName(name);
        signed.setSupervisorPosition(position);
        signed.setContactNo(contact);
        signed.setSignedDate(date == null ? null : Timestamp.valueOf(date.atStartOfDay()));
        signed.setPeriodFrom(from);
        signed.setPeriodTo(to);
        signedRepository.save(signed);
    }

    /** Itinatala kung sinong coordinator ang huling nagwasto */
    public void markEdited(Evaluation evaluation, Student s, String coordinatorName) {
        signedRepository.findByEvaluationIdAndStudentId(evaluation.getId(), s.getId()).ifPresent(signed -> {
            signed.setEditedByName(coordinatorName);
            signed.setEditedAt(new Timestamp(System.currentTimeMillis()));
            signedRepository.save(signed);
        });
    }

    /** Dahilan kung bakit hindi pa pwedeng i-turn in; null kung ayos na */
    public String turnInProblem(Evaluation evaluation, Student s, Long requirementId) {
        boolean hasCopy = false;
        for (SubmissionFile f : fileRepository.findByStudentIdAndScopeAndRefIdOrderByIdAsc(
                s.getId(), StudentWorkService.REQUIREMENT, requirementId)) {
            if ("FILE".equals(f.getKind()) && isSignedCopyName(f.getName())) hasCopy = true;
        }
        if (!hasCopy) return "Upload the signed copy (an image or PDF) before turning in.";
        if (evaluation == null) return null;

        List<String> missing = new ArrayList<>();
        boolean any = false;
        for (CriterionScore c : view(evaluation, s, false).criteria()) {
            if (c.score() == null) missing.add(c.name());
            else any = true;
        }
        if (any && !missing.isEmpty()) {
            return "Fill in all the scores before turning in. Missing: " + String.join(", ", missing) + ".";
        }
        return null;
    }

    private static Info info(Student s) {
        String initial = s.getMiddleInitial() == null || s.getMiddleInitial().isBlank() ? "" : " " + s.getMiddleInitial() + ".";
        Department d = s.getDepartment();
        return new Info(s.getLastname() + ", " + s.getFirstname() + initial,
                s.getCoordinator() == null || s.getCoordinator().getProgram() == null
                        ? null : s.getCoordinator().getProgram().getName(),
                d == null || d.getCompany() == null ? null : d.getCompany().getName(),
                d == null || d.getCompany() == null ? null : d.getCompany().getAddress(),
                d == null ? null : d.getName(),
                s.getSemester() == null ? null : s.getSemester().getSemester());
    }

    private static String text(String value, int max, String label) {
        if (value == null || value.isBlank()) return null;
        String v = value.trim();
        if (v.length() > max) throw new IllegalArgumentException(label + " is too long (max " + max + " characters).");
        return v;
    }

    private static LocalDate parseDate(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return LocalDate.parse(raw.trim());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Please enter a valid date.");
        }
    }

    private static String dateOnly(String raw) {
        if (raw == null || raw.length() < 10) return null;
        try {
            return LocalDate.parse(raw.substring(0, 10)).toString();
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
