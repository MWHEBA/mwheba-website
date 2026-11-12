import React from 'react';

interface SelectedWorkSectionProps {
  locale: string;
}

export function SelectedWorkSection({ locale }: SelectedWorkSectionProps) {
  const isArabic = locale === 'ar';

  return (
    <section className="section" id="work" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="container">
        <div className="section-heading reveal-on-scroll">
          <div>
            <span className="section-number">
              {isArabic ? '05 / آفاق إبداعية واستوديو التجارب' : '05 / CREATIVE POSSIBILITIES'}
            </span>
            <h2 className="display">
              {isArabic ? (
                <>
                  أعمال تترك<br />
                  <span style={{ color: 'var(--brand-primary)' }}>أثراً لا يُنسى.</span>
                </>
              ) : (
                <>
                  WORK THAT<br />
                  <span style={{ color: 'var(--brand-primary)' }}>FEELS DIFFERENT.</span>
                </>
              )}
            </h2>
          </div>
          <p className="reveal-on-scroll" style={{ transitionDelay: '0.2s' }}>
            {isArabic
              ? 'لمحة من المساحات البصرية التي نستكشفها في أنظمة الهويات التجارية وتجارب منتجات الشركات الملموسة.'
              : 'A glimpse of the visual territories we explore across identity systems and physical brand experiences.'}
          </p>
        </div>

        <div className="work">
          <div className="work-item reveal-on-scroll" data-aos="reveal-anim-up" data-aos-delay="150">
            <div className="work-art">
              <div className="work-shape">MW.</div>
            </div>
            <div className="work-meta">
              <h3>{isArabic ? 'الهوية في حركة دائمة' : 'Identity in Motion'}</h3>
              <span>{isArabic ? 'نظام هوية بصرية / دراسة استوديو' : 'BRAND SYSTEM / CONCEPT STUDY'}</span>
            </div>
          </div>

          <div className="work-item reveal-on-scroll" data-aos="reveal-anim-up" data-aos-delay="300">
            <div className="work-art">
              <div className="work-shape">M.</div>
            </div>
            <div className="work-meta">
              <h3>{isArabic ? 'مجسمات التواصل والارتقاء' : 'Objects of Connection'}</h3>
              <span>{isArabic ? 'هدايا ومطبوعات الشركات / دراسة مفاهيمية' : 'CORPORATE GIFTING / CONCEPT STUDY'}</span>
            </div>
          </div>
        </div>

        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '16px' }}>
          {isArabic
            ? 'الدراسات والمفاهيم البصرية هي استكشافات استوديو توضيحية لآفاق التصميم، إلى جانب مشاريع عملاء الوكالة المعتمدة.'
            : 'Concept studies are illustrative, showcasing design directions alongside completed client engagements.'}
        </p>
      </div>
    </section>
  );
}
