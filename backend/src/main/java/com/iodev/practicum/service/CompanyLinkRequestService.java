package com.iodev.practicum.service;

import com.iodev.practicum.dto.CompanyRequestDtos.DuplicateView;
import com.iodev.practicum.dto.CompanyRequestDtos.LinkDepartmentInput;
import com.iodev.practicum.dto.CompanyRequestDtos.LinkDepartmentView;
import com.iodev.practicum.dto.CompanyRequestDtos.LinkMoaFile;
import com.iodev.practicum.dto.CompanyRequestDtos.LinkRequestInput;
import com.iodev.practicum.dto.CompanyRequestDtos.LinkRequestView;
import com.iodev.practicum.model.Company;
import com.iodev.practicum.model.CompanyNature;
import com.iodev.practicum.model.CompanyRequestLink;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.Department;
import com.iodev.practicum.model.DepartmentMoaFile;
import com.iodev.practicum.repository.CompanyNatureRepository;
import com.iodev.practicum.repository.CompanyRepository;
import com.iodev.practicum.repository.DepartmentMoaFileRepository;
import com.iodev.practicum.repository.DepartmentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Hiling mula sa public na link ng company: isang bagong Company na "pending" (nakatago sa lahat ng listahan)
 * kasama ang mga department nito na "pending". Ang coordinator ang mag-aayos, mag-a-approve, magme-merge
 * sa kasalukuyang company, o magre-reject. Walang account o password na ginagawa para sa company.
 * Walang file mula sa company: ang MOA (file at mga petsa) ay itinatala ng coordinator, opsyonal.
 */
@Service
public class CompanyLinkRequestService {

    public static final String SOURCE = "company_link";
    public static final String PENDING = "pending";
    public static final String APPROVED = "approved";
    public static final String REJECTED = "rejected";
    public static final String MERGED = "merged";

    public static final int MAX_DEPARTMENTS = 15;


    @Autowired private CompanyRepository companyRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private DepartmentMoaFileRepository moaFiles;
    @Autowired private CompanyNatureRepository natureRepository;
    @Autowired private SkillService skillService;

    // =====================================================================
    // Pagsusuri (iisa para sa public na form at sa pag-edit ng coordinator)
    // =====================================================================

    /**
     * @param isPublic public na form: kailangan ang dalawang checkbox ng privacy, at hindi tinatanggap ang MOA
     *                 (ang coordinator ang nagtatala nito). false = review ng coordinator.
     */
    public FieldErrors validate(LinkRequestInput in, boolean isPublic) {
        FieldErrors e = new FieldErrors();
        String name = clean(in.companyName());
        String address = clean(in.address());
        String location = clean(in.location());
        String contact = SupervisorResolver.cleanContact(in.companyContactNumber());
        String description = in.description() == null ? "" : in.description().trim();

        if (name.isEmpty()) e.add("companyName", "Enter the company name.");
        else if (name.length() > 255) e.add("companyName", "Company name is too long (max 255 characters).");
        CompanyNature chosen = in.natureId() == null ? null : natureRepository.findById(in.natureId()).orElse(null);
        if (chosen == null) {
            e.add("natureId", "Select the nature of the company.");
        } else {
            String natureError = CompanyNatures.problem(chosen, in.natureOther());
            if (natureError != null) e.add("natureOther", natureError);
        }
        if (address.isEmpty()) e.add("address", "Enter the company address.");
        else if (address.length() > 255) e.add("address", "Address is too long (max 255 characters).");
        if (location.length() > 255) e.add("location", "Location is too long (max 255 characters).");
        if (contact.isEmpty()) e.add("companyContactNumber", "Enter the company contact number.");
        else if (contact.length() > SupervisorResolver.CONTACT_MAX) {
            e.add("companyContactNumber", SupervisorResolver.CONTACT_TOO_LONG);
        }
        if (description.length() > 5000) e.add("description", "The description is too long (max 5000 characters).");
        // Immediate supervisor ng company: kailangan lahat
        SupervisorResolver.requireAll(e, "contact", in.contactFullname(), in.contactPosition(),
                in.contactNumber(), in.contactEmail());
        if (clean(in.idType()).length() > 255) e.add("idType", "The ID type is too long.");
        if (clean(in.idNumber()).length() > 255) e.add("idNumber", "The ID number is too long.");
        String skillsError = SkillService.validate(in.skills());
        if (skillsError != null) e.add("skills", skillsError);

        boolean hasDepartments = Boolean.TRUE.equals(in.hasDepartments());
        List<LinkDepartmentInput> rows = in.departments() == null ? List.of() : in.departments();
        if (hasDepartments) {
            if (rows.isEmpty()) e.add("departments", "Add at least one department, or choose No.");
            if (rows.size() > MAX_DEPARTMENTS) {
                e.add("departments", "You can add up to " + MAX_DEPARTMENTS + " departments at a time.");
            }
        } else if (rows.isEmpty()) {
            e.add("departments[0].slots", "Enter the number of slots.");
        }

        int count = hasDepartments ? Math.min(rows.size(), MAX_DEPARTMENTS) : Math.min(rows.size(), 1);
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < count; i++) {
            LinkDepartmentInput row = rows.get(i);
            String at = "departments[" + i + "].";
            if (row == null) {
                e.add(at + "slots", "Fill in this department.");
                continue;
            }
            if (hasDepartments) {
                String dn = clean(row.name());
                if (dn.isEmpty()) e.add(at + "name", "Enter the department name.");
                else if (dn.length() > 255) e.add(at + "name", "Department name is too long (max 255 characters).");
                else if (SupervisorResolver.isPlaceholderDepartment(dn)) {
                    e.add(at + "name", "If the company has no departments, choose No instead.");
                } else if (!seen.add(CompanyMatch.normalize(dn).replace(" ", ""))) {
                    e.add(at + "name", "This department is already in the list.");
                }
            }
            if (row.slots() == null || row.slots() < 1 || row.slots() > 500) {
                e.add(at + "slots", "Slots must be a number from 1 to 500.");
            }
            // Supervisor ng department: opsyonal; kapag blangko, ang immediate supervisor ang gagamitin.
            // Ang N/A (walang department) ay walang sariling supervisor, kaya hindi ito sinusuri (hindi rin sine-save).
            if (hasDepartments) {
                SupervisorResolver.optionalPair(e, at + "supervisor", row.supervisorFullname(), row.supervisorPosition(),
                        row.supervisorContactNumber(), row.supervisorEmail());
            }
            // Ang petsa ng MOA ay itinatala ng coordinator sa review (hindi galing sa company)
            if (!isPublic) validateMoaDates(e, at, row.moaStart(), row.moaExpiration());
        }

        if (isPublic) {
            if (!Boolean.TRUE.equals(in.supervisorPermission())) {
                e.add("supervisorPermission", "Confirm that you have the supervisor's permission to share these contact details.");
            }
            if (!Boolean.TRUE.equals(in.consent())) {
                e.add("consent", "You need to agree to the Data Privacy Notice to continue.");
            }
        }
        return e;
    }

    /**
     * Parehong tuntunin ng department form ng coordinator: yyyy-MM-dd, taon 2000 hanggang 2100,
     * at ang expiration ay hindi puwedeng mas maaga sa simula. Parehong opsyonal.
     */
    private static void validateMoaDates(FieldErrors e, String at, String rawStart, String rawEnd) {
        LocalDate start = null, end = null;
        try {
            start = parseDate(rawStart, "MOA start date");
        } catch (IllegalArgumentException ex) {
            e.add(at + "moaStart", ex.getMessage());
        }
        try {
            end = parseDate(rawEnd, "MOA expiration date");
        } catch (IllegalArgumentException ex) {
            e.add(at + "moaExpiration", ex.getMessage());
        }
        if (start != null && end != null && end.isBefore(start)) {
            e.add(at + "moaExpiration", "The MOA expiration can't be before its start date.");
        }
    }

    private static LocalDate parseDate(String raw, String label) {
        String v = raw == null ? "" : raw.trim();
        if (v.isEmpty()) return null;
        try {
            LocalDate d = LocalDate.parse(v);
            if (d.getYear() < 2000 || d.getYear() > 2100) {
                throw new IllegalArgumentException(label + " must be between the years 2000 and 2100.");
            }
            return d;
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException(label + " must look like 2026-10-30.");
        }
    }

    // =====================================================================
    // Paggawa (public na form)
    // =====================================================================

    /** Laging bagong Company (kahit kapangalan ng nasa listahan na); ang coordinator ang magpapasya kung i-merge */
    public Company createPending(CompanyRequestLink link, LinkRequestInput in, String privacyVersion) {
        LocalDateTime now = LocalDateTime.now();
        Company c = new Company();
        c.setCoordinator(link.getCoordinator());
        c.setSemester(link.getSemester());
        c.setRequestSource(SOURCE);
        c.setRequestStatus(PENDING);
        applyCompany(c, in);
        c = companyRepository.save(c);

        for (LinkDepartmentInput row : rowsOf(in)) {
            Department d = new Department();
            d.setCompany(c);
            d.setStatus("pending");
            d.setRequestedByStudentId(null);
            d.setRequestSource(SOURCE);
            d.setPrivacyConsentAt(now);
            d.setPrivacyNoticeVersion(privacyVersion);
            d.setSupervisorShareConfirmedAt(now);
            applyDepartment(d, row, Boolean.TRUE.equals(in.hasDepartments()), false);
            departmentRepository.save(d);
        }
        return c;
    }

    // =====================================================================
    // Review ng coordinator
    // =====================================================================

    /** Pending na hiling ng coordinator na ito; null kung wala o hindi kaniya */
    public Company ownRequest(Long companyId, Coordinator coordinator) {
        Company c = companyRepository.findById(companyId).orElse(null);
        if (c == null || !SOURCE.equals(c.getRequestSource()) || c.getRequestStatus() == null) return null;
        if (!c.getCoordinator().getId().equals(coordinator.getId())) return null;
        return c;
    }

    private static void requirePending(Company c) {
        if (!PENDING.equals(c.getRequestStatus())) throw ActionException.conflict("This request was already reviewed.");
    }

    /** Pag-edit ng buong hiling (napatunayan na ng validate). Ang inalis na department ay ina-archive. */
    public void edit(Company c, LinkRequestInput in) {
        requirePending(c);
        applyCompany(c, in);
        companyRepository.save(c);

        boolean hasDepartments = Boolean.TRUE.equals(in.hasDepartments());
        List<Department> current = departmentRepository.findActiveByCompanyIds(List.of(c.getId()));
        Set<Long> kept = new HashSet<>();
        for (LinkDepartmentInput row : rowsOf(in)) {
            Department d = row.id() == null ? null
                    : current.stream().filter(x -> x.getId().equals(row.id())).findFirst().orElse(null);
            if (d == null) {
                if (row.id() != null) throw ActionException.bad("A department in this request wasn't found. Reload and try again.");
                d = new Department();
                d.setCompany(c);
                d.setStatus("pending");
                d.setRequestSource(SOURCE);
                // Pareho ang pahintulot ng buong hiling
                Department first = current.isEmpty() ? null : current.get(0);
                if (first != null) {
                    d.setPrivacyConsentAt(first.getPrivacyConsentAt());
                    d.setPrivacyNoticeVersion(first.getPrivacyNoticeVersion());
                    d.setSupervisorShareConfirmedAt(first.getSupervisorShareConfirmedAt());
                }
            }
            applyDepartment(d, row, hasDepartments, true);
            d = departmentRepository.save(d);
            kept.add(d.getId());
        }
        for (Department d : current) {
            if (!kept.contains(d.getId())) {
                d.setIsArchived(true);
                departmentRepository.save(d);
            }
        }
    }

    public void approve(Company c) {
        requirePending(c);
        LocalDateTime now = LocalDateTime.now();
        List<Department> departments = departmentRepository.findActiveByCompanyIds(List.of(c.getId()));
        if (departments.isEmpty()) throw ActionException.bad("Add at least one department (or N/A) before approving.");
        for (Department d : departments) {
            d.setStatus("approved");
            d.setReviewedAt(now);
            d.setDeclineReason(null);
            departmentRepository.save(d);
        }
        c.setRequestStatus(APPROVED);
        c.setRequestReviewedAt(now);
        c.setRequestReason(null);
        companyRepository.save(c);
        // Saka lang pumapasok sa catalog ang skills, pagkatapos masuri ng coordinator
        skillService.setCompanySkills(c, skillsOf(c));
    }

    /** Inililipat ang mga department sa kasalukuyang company (approved na), at itinatago ang hiling */
    public Company merge(Company c, Long targetId) {
        requirePending(c);
        Company target = targetId == null ? null : companyRepository.findById(targetId).orElse(null);
        if (target == null || target.isHiddenRequest() || Boolean.TRUE.equals(target.getIsArchived())
                || !target.getCoordinator().getId().equals(c.getCoordinator().getId())
                || !target.getSemester().getId().equals(c.getSemester().getId())) {
            throw ActionException.bad("Choose a company from your list to merge into.");
        }
        if (target.getId().equals(c.getId())) throw ActionException.bad("Choose a different company.");

        List<Department> moving = departmentRepository.findActiveByCompanyIds(List.of(c.getId()));
        if (moving.isEmpty()) throw ActionException.bad("This request has no departments to merge.");
        List<Department> existing = departmentRepository.findActiveByCompanyIds(List.of(target.getId())).stream()
                .filter(d -> !"declined".equalsIgnoreCase(d.getStatus())).toList();
        List<String> clashes = new ArrayList<>();
        for (Department d : moving) {
            if (existing.stream().anyMatch(x -> CompanyMatch.sameDepartment(
                    SupervisorResolver.departmentLabel(x.getName()), SupervisorResolver.departmentLabel(d.getName())))) {
                clashes.add(SupervisorResolver.departmentLabel(d.getName()));
            }
        }
        if (!clashes.isEmpty()) {
            throw ActionException.conflict(target.getName() + " already has " + String.join(", ", clashes)
                    + ". Rename or remove " + (clashes.size() == 1 ? "it" : "them") + " in this request first.");
        }

        LocalDateTime now = LocalDateTime.now();
        for (Department d : moving) {
            d.setCompany(target);
            d.setStatus("approved");
            d.setReviewedAt(now);
            d.setDeclineReason(null);
            departmentRepository.save(d);
        }
        // Idinadagdag ang skills ng hiling sa skills ng company (hindi pinapalitan)
        LinkedHashSet<String> union = new LinkedHashSet<>(skillService.companySkills(List.of(target.getId()))
                .getOrDefault(target.getId(), List.of()));
        union.addAll(skillsOf(c));
        skillService.setCompanySkills(target, union);

        c.setRequestStatus(MERGED);
        c.setRequestReviewedAt(now);
        c.setRequestReason("Merged into " + target.getName());
        c.setIsArchived(true);
        companyRepository.save(c);
        return target;
    }

    /** Nananatili ang rekord (naka-archive). Hindi nito hinaharangan ang muling pagsumite. */
    public void reject(Company c, String reason) {
        requirePending(c);
        String why = reason == null ? "" : reason.trim();
        if (why.length() > 1000) throw ActionException.bad("The reason is too long (max 1000 characters).");
        LocalDateTime now = LocalDateTime.now();
        for (Department d : departmentRepository.findActiveByCompanyIds(List.of(c.getId()))) {
            d.setStatus("declined");
            d.setDeclineReason(why.isEmpty() ? null : why);
            d.setReviewedAt(now);
            departmentRepository.save(d);
        }
        c.setRequestStatus(REJECTED);
        c.setRequestReviewedAt(now);
        c.setRequestReason(why.isEmpty() ? null : why);
        c.setIsArchived(true);
        companyRepository.save(c);
    }

    // =====================================================================
    // Para sa listahan ng review
    // =====================================================================

    public List<LinkRequestView> views(Coordinator coordinator, Long semesterId) {
        List<Company> requests = companyRepository.findLinkRequests(coordinator.getId(), semesterId);
        if (requests.isEmpty()) return List.of();

        List<Long> ids = requests.stream().map(Company::getId).toList();
        Map<Long, List<Department>> deptsOf = new HashMap<>();
        for (Department d : departmentRepository.findAllByCompanyIds(ids)) {
            // Ang pending ay ipinapakita ang hindi naka-archive; ang tapos na ay ang lahat ng hindi inalis sa review
            deptsOf.computeIfAbsent(d.getCompany().getId(), k -> new ArrayList<>()).add(d);
        }
        Map<Long, List<LinkMoaFile>> filesOf = new HashMap<>();
        List<Long> deptIds = deptsOf.values().stream().flatMap(List::stream).map(Department::getId).toList();
        if (!deptIds.isEmpty()) {
            for (DepartmentMoaFile f : moaFiles.findByDepartmentIds(deptIds)) {
                filesOf.computeIfAbsent(f.getDepartment().getId(), k -> new ArrayList<>())
                        .add(new LinkMoaFile(f.getId(), f.getOriginalName(), f.getContentType(), f.getFileSize()));
            }
        }

        // Para sa babala ng posibleng kapareho: ang mga company sa listahan at ang ibang pending na hiling
        List<Company> listed = companyRepository.findForAssignment(coordinator.getId(), semesterId);
        List<LinkRequestView> out = new ArrayList<>();
        for (Company c : requests) {
            List<Department> depts = deptsOf.getOrDefault(c.getId(), List.of()).stream()
                    .filter(d -> !Boolean.TRUE.equals(d.getIsArchived()) || !PENDING.equals(c.getRequestStatus()))
                    .filter(d -> !(MERGED.equals(c.getRequestStatus())))
                    .sorted(Comparator.comparing(Department::getId))
                    .toList();
            boolean hasDepartments = depts.stream().anyMatch(d -> !SupervisorResolver.isPlaceholderDepartment(d.getName()));

            List<DuplicateView> duplicates = new ArrayList<>();
            if (PENDING.equals(c.getRequestStatus())) {
                for (Company other : listed) {
                    if (CompanyMatch.similar(other.getName(), c.getName())) {
                        duplicates.add(new DuplicateView(other.getId(), other.getName(), "company"));
                    }
                }
                for (Company other : requests) {
                    if (!other.getId().equals(c.getId()) && PENDING.equals(other.getRequestStatus())
                            && CompanyMatch.similar(other.getName(), c.getName())) {
                        duplicates.add(new DuplicateView(other.getId(), other.getName(), "request"));
                    }
                }
            }

            Department first = depts.isEmpty() ? null : depts.get(0);
            out.add(new LinkRequestView(
                    c.getId(), c.getRequestStatus(), c.getRequestReason(),
                    c.getCreatedAt() == null ? null : c.getCreatedAt().toLocalDateTime().toString(),
                    c.getRequestReviewedAt() == null ? null : c.getRequestReviewedAt().toString(),
                    c.getName(),
                    c.getNature() == null ? null : c.getNature().getId(),
                    CompanyNatures.label(c),
                    c.getAddress(), c.getLocation(), c.getContactNumber(), c.getDescription(),
                    SupervisorResolver.cleanOrNull(c.getImsupFullname()),
                    SupervisorResolver.cleanOrNull(c.getImsupPosition()),
                    SupervisorResolver.cleanOrNull(c.getImsupContactNumber()),
                    SupervisorResolver.cleanOrNull(c.getImsupEmail()),
                    c.getImsupCompEvidIdentity(), c.getImsupCompEvidIdentityNo(),
                    hasDepartments,
                    depts.stream().map(d -> new LinkDepartmentView(
                            d.getId(), SupervisorResolver.departmentLabel(d.getName()),
                            SupervisorResolver.isPlaceholderDepartment(d.getName()), d.getSlots(),
                            SupervisorResolver.cleanOrNull(d.getSupervisorFullname()),
                            SupervisorResolver.cleanOrNull(d.getSupervisorPosition()),
                            SupervisorResolver.cleanOrNull(d.getSupervisorContactNumber()),
                            SupervisorResolver.cleanOrNull(d.getSupervisorEmail()),
                            d.getMoaStart(), d.getMoaExpiration(), d.getStatus(), d.getDeclineReason(),
                            filesOf.getOrDefault(d.getId(), List.of()))).toList(),
                    skillsOf(c),
                    first == null || first.getPrivacyConsentAt() == null ? null : first.getPrivacyConsentAt().toString(),
                    first == null ? null : first.getPrivacyNoticeVersion(),
                    duplicates,
                    CompanyNatures.isOther(c.getNature()) ? CompanyNatures.cleanOther(c.getNatureOther()) : null));
        }
        return out;
    }

    // =====================================================================
    // Mga helper
    // =====================================================================

    /** Ang mga department na isusulat: lahat kapag Yes, o iisang N/A kapag No */
    private static List<LinkDepartmentInput> rowsOf(LinkRequestInput in) {
        List<LinkDepartmentInput> rows = in.departments() == null ? List.of() : in.departments();
        if (Boolean.TRUE.equals(in.hasDepartments())) return rows.stream().limit(MAX_DEPARTMENTS).toList();
        return rows.isEmpty() ? List.of() : List.of(rows.get(0));
    }

    private void applyCompany(Company c, LinkRequestInput in) {
        CompanyNature nature = in.natureId() == null ? null : natureRepository.findById(in.natureId()).orElse(null);
        c.setName(clean(in.companyName()));
        c.setNature(nature);
        c.setNatureOther(CompanyNatures.storedOther(nature, in.natureOther()));
        c.setAddress(clean(in.address()));
        c.setLocation(emptyToNull(clean(in.location())));
        c.setContactNumber(SupervisorResolver.cleanContact(in.companyContactNumber()));
        c.setDescription(in.description() == null ? null : emptyToNull(in.description().trim()));
        c.setImsupFullname(clean(in.contactFullname()));
        c.setImsupPosition(clean(in.contactPosition()));
        c.setImsupContactNumber(SupervisorResolver.cleanContact(in.contactNumber()));
        c.setImsupEmail(clean(in.contactEmail()).toLowerCase());
        c.setImsupCompEvidIdentity(emptyToNull(clean(in.idType())));
        c.setImsupCompEvidIdentityNo(emptyToNull(clean(in.idNumber())));
        c.setRequestSkills(joinSkills(in.skills()));
    }

    /** withMoa: true lang sa review ng coordinator (hindi kailanman galing sa company) */
    private static void applyDepartment(Department d, LinkDepartmentInput row, boolean hasDepartments, boolean withMoa) {
        d.setName(hasDepartments ? clean(row.name()) : "N/A");
        d.setSlots(row.slots());
        // Blangkong teksto (hindi null), gaya ng ibang department, para hindi mabangga ang lumang NOT NULL.
        // N/A: walang sariling supervisor; ang immediate supervisor ng company ang ginagamit ng mga student.
        d.setSupervisorFullname(hasDepartments ? clean(row.supervisorFullname()) : "");
        d.setSupervisorPosition(hasDepartments ? clean(row.supervisorPosition()) : "");
        d.setSupervisorContactNumber(hasDepartments ? SupervisorResolver.cleanContact(row.supervisorContactNumber()) : "");
        d.setSupervisorEmail(hasDepartments ? clean(row.supervisorEmail()).toLowerCase() : "");
        if (withMoa) {
            LocalDate start = parseDate(row.moaStart(), "MOA start date");
            LocalDate end = parseDate(row.moaExpiration(), "MOA expiration date");
            d.setMoaStart(start == null ? null : start.toString());
            d.setMoaExpiration(end == null ? null : end.toString());
        }
        d.setIsArchived(false);
    }

    /** Skills na naka-text pa lang (isa bawat linya), nilinis at walang doble */
    private static String joinSkills(Collection<String> raw) {
        if (raw == null) return null;
        LinkedHashMap<String, String> out = new LinkedHashMap<>();
        for (String r : raw) {
            String name = SkillService.displayName(r);
            String key = SkillService.normalize(name);
            if (!key.isEmpty() && name.length() <= SkillService.MAX_LENGTH) out.putIfAbsent(key, name);
        }
        String joined = String.join("\n", out.values());
        while (joined.length() > 1000 && joined.contains("\n")) joined = joined.substring(0, joined.lastIndexOf('\n'));
        return joined.isEmpty() ? null : joined;
    }

    public static List<String> skillsOf(Company c) {
        String raw = c.getRequestSkills();
        if (raw == null || raw.isBlank()) return List.of();
        return Arrays.stream(raw.split("\n")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    private static String clean(String v) {
        return v == null ? "" : v.trim().replaceAll("\\s+", " ");
    }

    private static String emptyToNull(String v) {
        return v == null || v.isEmpty() ? null : v;
    }
}
