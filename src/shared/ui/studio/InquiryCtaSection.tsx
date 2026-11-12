'use client';

import React, { useState } from 'react';
import { ArrowUpRightIcon } from '@/shared/ui/icons';

interface InquiryCtaSectionProps {
  locale: string;
}

export function InquiryCtaSection({ locale }: InquiryCtaSectionProps) {
  const isArabic = locale === 'ar';
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [interest, setInterest] = useState('');
  const [brief, setBrief] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formattedBody = `MWHEBA PROJECT INQUIRY
Name: ${name.trim()}
Email: ${email.trim()}
Company: ${company.trim()}
Interest: ${interest}

Project brief:
${brief.trim()}`;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(formattedBody);
      } else {
        const area = document.createElement('textarea');
        area.value = formattedBody;
        area.style.position = 'fixed';
        area.style.left = '-9999px';
        document.body.append(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 3500);
    }
  };

  return (
    <section className="section cta reveal-on-scroll" id="contact" data-aos="fade-up-sm">
      <div className="cta-ring-secondary" aria-hidden="true" />
      <div className="container cta-grid" style={{ maxWidth: '1480px' }}>
        <div>
          <span className="section-number" style={{ color: 'var(--brand-ice)' }}>
            07 / LET&apos;S MAKE SOMETHING
          </span>

          <h2 className="display">
            HAVE AN<br />
            IDEA?<br />
            <em>MAKE IT</em><br />
            REAL<span style={{ color: 'var(--brand-coral)' }}>.</span>
          </h2>

          <p>
            {isArabic
              ? 'من أول تصور للهوية التجارية حتى الصندوق الفاخر المطبوع، دعنا نبني ما يدوم في ذاكرة عملائك.'
              : "From the first brand sketch to the final branded box, let's build something your audience will remember."}
          </p>

          <p style={{ fontSize: '12px', marginTop: '25px', opacity: 0.85 }}>
            {isArabic
              ? 'الإسكندرية، مصر · نخدم كبرى الشركات والمؤسسات في كافة محافظات مصر'
              : 'Alexandria, Egypt · Serving corporate teams across Egypt'}
          </p>
        </div>

        <form className="form" id="inquiry" onSubmit={handleSubmit}>
          <h3>
            {isArabic ? 'أخبرنا بما تخطط له.' : "Tell us what you're planning."}
          </h3>

          <input
            className="field"
            id="clientName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isArabic ? 'الاسم الكريم *' : 'Your name *'}
            required
            maxLength={100}
          />

          <input
            className="field"
            id="clientEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={isArabic ? 'البريد الإلكتروني للعمل *' : 'Work email *'}
            required
            maxLength={150}
          />

          <input
            className="field"
            id="company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder={isArabic ? 'اسم الشركة / المؤسسة' : 'Company / organization'}
            maxLength={120}
          />

          <select
            className="field"
            id="interest"
            value={interest}
            onChange={(e) => setInterest(e.target.value)}
            required
          >
            <option value="">{isArabic ? 'ما هي متطلباتك؟ *' : 'What do you need? *'}</option>
            <option value="Corporate gifts & merchandise">
              {isArabic ? 'هدايا ومطبوعات الشركات' : 'Corporate gifts & merchandise'}
            </option>
            <option value="Brand identity & design">
              {isArabic ? 'تصميم وبناء الهوية التجارية' : 'Brand identity & design'}
            </option>
            <option value="Campaign & digital services">
              {isArabic ? 'تطوير المنصات والحملات الرقمية' : 'Campaign & digital services'}
            </option>
            <option value="Both creative & merchandise">
              {isArabic ? 'الخدمات الإبداعية وتوريد الهدايا معاً' : 'Both creative & merchandise'}
            </option>
          </select>

          <textarea
            className="field"
            id="brief"
            rows={3}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder={isArabic ? 'نبذة مختصرة عن المشروع والكمية المستهدفة' : 'A few words about your project'}
            maxLength={1500}
          />

          <button
            type="submit"
            className="dark-btn"
            style={{ width: '100%', marginTop: '17px', justifyContent: 'center' }}
          >
            <span>
              {copied
                ? isArabic
                  ? 'تم نسخ تفاصيل الطلب بنجاح ✓'
                  : 'Copied to clipboard ✓'
                : isArabic
                ? 'نسخ تفاصيل الاستفسار'
                : 'Copy Inquiry Details'}
            </span>
            <ArrowUpRightIcon size={16} />
          </button>

          <p className="form-note">
            {isArabic
              ? 'يقوم الزر بنسخ تفاصيل استفسارك لتتمكن من إرسالها عبر بريدك أو تطبيقك المفضل. لا نقوم بمشاركة بياناتك.'
              : 'Copies your inquiry so you can send it through your preferred channel. No information is sent to a server.'}
          </p>
        </form>
      </div>
    </section>
  );
}

