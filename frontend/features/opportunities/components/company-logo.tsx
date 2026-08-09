'use client'

import React, { useState, useEffect, useRef } from 'react'

interface CompanyLogoProps {
  src?: string | null
  alt?: string
  name?: string
  containerClassName?: string
  imageClassName?: string
  fallbackIconClassName?: string
}

/**
 * Known employer domains, for companies whose real logo we can resolve.
 *
 * This used to be an 11-entry list of US megacaps, which is why an employer
 * like PhonePe — a company we ingest hundreds of roles from — rendered as bare
 * initials. It now covers the employers actually in the catalogue.
 *
 * Deliberately a lookup rather than a guess: inferring "<name>.com" would
 * produce a wrong-company logo, which is worse than initials. Anything not
 * listed and without a stored logo falls back to initials, never to a
 * placeholder image pretending to be a brand.
 */
const COMPANY_DOMAINS: Record<string, string> = {
  // India
  phonepe: 'phonepe.com', paytm: 'paytm.com', meesho: 'meesho.com', swiggy: 'swiggy.com',
  zomato: 'zomato.com', flipkart: 'flipkart.com', cred: 'cred.club', groww: 'groww.in',
  razorpay: 'razorpay.com', freshworks: 'freshworks.com', zoho: 'zoho.com', druva: 'druva.com',
  unacademy: 'unacademy.com', ixigo: 'ixigo.com', naukri: 'naukri.com', zeta: 'zeta.tech',
  highradius: 'highradius.com', mindtickle: 'mindtickle.com', netomi: 'netomi.com',
  fampay: 'fampay.in', sigmoid: 'sigmoid.com', slice: 'sliceit.com', kredx: 'kredx.com',
  lendingkart: 'lendingkart.com', freecharge: 'freecharge.in', zinghr: 'zinghr.com',
  'observe.ai': 'observe.ai', observeai: 'observe.ai', 'fi money': 'fi.money', epifi: 'fi.money',
  'captain fresh': 'captainfresh.in', unstop: 'unstop.com', internshala: 'internshala.com',
  // Global
  amazon: 'amazon.com', google: 'google.com', microsoft: 'microsoft.com', apple: 'apple.com',
  meta: 'meta.com', github: 'github.com', atlassian: 'atlassian.com', adobe: 'adobe.com',
  oracle: 'oracle.com', salesforce: 'salesforce.com', ibm: 'ibm.com', stripe: 'stripe.com',
  databricks: 'databricks.com', mongodb: 'mongodb.com', gitlab: 'gitlab.com', twilio: 'twilio.com',
  okta: 'okta.com', datadog: 'datadoghq.com', cloudflare: 'cloudflare.com', coinbase: 'coinbase.com',
  airbnb: 'airbnb.com', postman: 'postman.com', vercel: 'vercel.com', figma: 'figma.com',
  reddit: 'reddit.com', pinterest: 'pinterest.com', dropbox: 'dropbox.com', discord: 'discord.com',
  canva: 'canva.com', wise: 'wise.com', elastic: 'elastic.co', fastly: 'fastly.com',
  samsara: 'samsara.com', fivetran: 'fivetran.com', clickhouse: 'clickhouse.com',
  instacart: 'instacart.com', anthropic: 'anthropic.com', affirm: 'affirm.com',
  flexport: 'flexport.com', gusto: 'gusto.com', asana: 'asana.com', smartsheet: 'smartsheet.com',
  lattice: 'lattice.com', netlify: 'netlify.com', planetscale: 'planetscale.com',
  amplitude: 'amplitude.com', mixpanel: 'mixpanel.com', launchdarkly: 'launchdarkly.com',
  jfrog: 'jfrog.com', duolingo: 'duolingo.com', lyft: 'lyft.com', faire: 'faire.com',
  circleci: 'circleci.com', sezzle: 'sezzle.com', wrike: 'wrike.com', justworks: 'justworks.com',
  hightouch: 'hightouch.com', storyblok: 'storyblok.com', sonarsource: 'sonarsource.com',
  cockroachlabs: 'cockroachlabs.com', 'cockroach labs': 'cockroachlabs.com',
  'scale ai': 'scale.com', scaleai: 'scale.com', airtable: 'airtable.com', '360learning': '360learning.com',
};

function getMappedLogo(name?: string): string | null {
  if (!name) return null;
  const n = name.toLowerCase().trim();

  // Exact match first, so "Meta" never matches "Metabase".
  let domain = COMPANY_DOMAINS[n];

  if (!domain) {
    // Then a whole-word match, so "PhonePe India Pvt Ltd" still resolves while
    // an unrelated name containing the letters does not.
    for (const [key, value] of Object.entries(COMPANY_DOMAINS)) {
      if (new RegExp(`(^|\\s)${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(n)) {
        domain = value;
        break;
      }
    }
  }

  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null;
}

function getInitials(name: string) {
  const clean = name.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const parts = clean.split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'C';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export const CompanyLogo = React.memo(function CompanyLogo({ 
  src, 
  alt = 'Company Logo',
  name,
  containerClassName = "w-14 h-14 rounded-xl bg-surface-container-lowest flex items-center justify-center border border-outline-variant/60 shadow-sm overflow-hidden shrink-0",
  imageClassName = "w-8 h-8 object-contain",
  fallbackIconClassName = "material-symbols-outlined text-on-surface-variant text-[24px]"
}: CompanyLogoProps) {
  const companyName = name || alt.replace(/ logo$/i, '').trim();
  const mappedLogo = getMappedLogo(companyName);
  
  const [imgState, setImgState] = useState<'mapped' | 'src' | 'initials'>(
    mappedLogo ? 'mapped' : (src ? 'src' : 'initials')
  )

  const imgRef = useRef<HTMLImageElement>(null)

  const currentSrc = imgState === 'mapped' ? mappedLogo : (imgState === 'src' ? src : null);

  useEffect(() => {
    setImgState(mappedLogo ? 'mapped' : (src ? 'src' : 'initials'))
  }, [src, mappedLogo])

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth === 0) {
      handleError()
    }
  }, [currentSrc])

  const handleError = () => {
    if (imgState === 'mapped') {
      setImgState(src ? 'src' : 'initials')
    } else if (imgState === 'src') {
      setImgState('initials')
    }
  }

  // Derive a fallback container style from imageClassName to roughly match dimensions
  const isLarge = imageClassName.includes('w-12') || imageClassName.includes('w-10');
  const fallbackClass = `${imageClassName.replace('object-contain', '')} flex items-center justify-center bg-primary/10 text-primary font-bold rounded-full ${isLarge ? 'text-lg' : 'text-sm'}`;

  return (
    <div className={containerClassName}>
      {imgState !== 'initials' && currentSrc ? (
        <img
          ref={imgRef}
          src={currentSrc}
          alt={alt}
          className={imageClassName}
          onError={handleError}
          loading="lazy"
        />
      ) : (
        <div className={fallbackClass}>
          {getInitials(companyName || 'Company')}
        </div>
      )}
    </div>
  )
})
