"use client";

import { HandPhoneMockup } from "@/components/partner-site/hand-phone-mockup";
import { SocialAppScreen } from "@/components/partner-site/social-screens";
import type { PartnerSiteSocialLink } from "@/lib/partner-site-socials";

/**
 * Правая колонка шага соцсети: фотомокап с QR-экраном площадки.
 * Форма НЕ растёт — телефон absolute и торчит за её края.
 *
 * Вправо и вниз телефон обрезается по границе формы, вверх и влево вылетает
 * свободно — это и даёт объём. Обрезка считается, а не подбирается: правая
 * колонка сетки совпадает с правым и нижним краем диалога, телефон центрирован
 * по вертикали, поэтому вниз он свисает на половину разницы между своей высотой
 * (ширина × пропорции ассета) и высотой формы.
 */
const MOCKUP_WIDTH = "30rem";
/** Пропорции ассета hand-iphone-front.webp: 1200 × 1651 */
const MOCKUP_ASPECT = "1651 / 1200";
/** Высота диалога — задана в consultation-dialog */
const FORM_HEIGHT = "32rem";
/** Насколько телефон выходит за правый край формы до обрезки */
const OVERHANG_RIGHT = "4rem";
/** rounded-2xl у формы: срез идёт по её скруглению, а не углом за него */
const FORM_RADIUS = "1rem";
/**
 * На сколько окно обрезки вынесено вверх и влево за пределы формы. Тень телефона
 * размыта на 60px и уходит левее его бокса; если резать по боксу, на фоне остаётся
 * вертикальная полоса. Запас кратно больше размытия — среза не видно.
 */
const CLIP_SLACK = "12rem";

/** Свес вниз: телефон центрирован по высоте формы */
const PHONE_BOTTOM = `calc((${FORM_HEIGHT} - ${MOCKUP_WIDTH} * ${MOCKUP_ASPECT}) / 2)`;

export function ConsultationSocialPhone({
  social,
  brandName,
  brandLogo
}: {
  social: PartnerSiteSocialLink;
  brandName: string;
  brandLogo?: string | undefined;
  projectImageUrl?: string | undefined;
  projectName?: string | undefined;
}) {
  return (
    // h-full = высота колонки формы; overflow visible, чтобы телефон рисовался снаружи.
    // Ни заливки, ни разделителя: своя заливка давала тёмный прямоугольник,
    // край которого читался как шлейф поперёк руки. Фон берётся у диалога
    <aside className="relative h-full min-h-0 overflow-visible">
      {/* Окно обрезки: справа и снизу совпадает с краями формы, вверх и влево
          вынесено с запасом — там телефон и его тень видны целиком */}
      <div
        className="pointer-events-none absolute right-0 bottom-0 z-30 overflow-hidden"
        style={{
          top: `-${CLIP_SLACK}`,
          left: `-${CLIP_SLACK}`,
          borderBottomRightRadius: FORM_RADIUS
        }}
      >
        <div
          className="absolute"
          style={{
            right: `-${OVERHANG_RIGHT}`,
            bottom: PHONE_BOTTOM,
            width: MOCKUP_WIDTH
          }}
        >
          <HandPhoneMockup className="w-full drop-shadow-[0_30px_60px_rgba(0,0,0,0.75)]">
            <SocialAppScreen
              platform={social.id}
              brandName={brandName || social.label}
              brandLogo={brandLogo}
              profileUrl={social.href}
            />
          </HandPhoneMockup>
        </div>
      </div>
    </aside>
  );
}
