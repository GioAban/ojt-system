package com.iodev.practicum.mail;

import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.sesv2.SesV2Client;
import software.amazon.awssdk.services.sesv2.model.Body;
import software.amazon.awssdk.services.sesv2.model.Content;
import software.amazon.awssdk.services.sesv2.model.Destination;
import software.amazon.awssdk.services.sesv2.model.EmailContent;
import software.amazon.awssdk.services.sesv2.model.Message;
import software.amazon.awssdk.services.sesv2.model.SendEmailRequest;
import software.amazon.awssdk.services.sesv2.model.SendEmailResponse;

/**
 * AWS SES v2 sa HTTPS (walang SMTP port). Parehong credentials ng S3: ang default chain ng AWS SDK
 * (AWS_ACCESS_KEY_ID at AWS_SECRET_ACCESS_KEY sa .env ng server). Ang SDK mismo ang umuulit kapag throttled.
 * Walang open o click tracking: huwag itong i-on sa configuration set.
 */
public class SesMailProvider implements MailProvider {

    private final String region;
    private final String configurationSet;
    private SesV2Client client;

    public SesMailProvider(String region, String configurationSet) {
        this.region = region;
        this.configurationSet = configurationSet == null || configurationSet.isBlank() ? null : configurationSet.trim();
    }

    @Override
    public String name() {
        return "ses";
    }

    @Override
    public String send(MailMessage m, String fromHeader, String replyTo) {
        SendEmailRequest.Builder req = SendEmailRequest.builder()
                .fromEmailAddress(fromHeader)
                .destination(Destination.builder().toAddresses(m.to()).build())
                .content(EmailContent.builder().simple(Message.builder()
                        .subject(utf8(m.subject()))
                        .body(Body.builder().text(utf8(m.text())).html(utf8(m.html())).build())
                        .build()).build());
        if (replyTo != null && !replyTo.isBlank()) req.replyToAddresses(replyTo.trim());
        if (configurationSet != null) req.configurationSetName(configurationSet);
        SendEmailResponse res = client().sendEmail(req.build());
        return res.messageId();
    }

    private static Content utf8(String data) {
        return Content.builder().data(data).charset("UTF-8").build();
    }

    private synchronized SesV2Client client() {
        if (client == null) client = SesV2Client.builder().region(Region.of(region)).build();
        return client;
    }
}
