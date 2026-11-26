'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useCart } from '../context/CartContext';
import { generateOperationKey } from '../logic/idempotency';
import { stockNotice } from '../logic/stockNotice';
import { Alert, Badge, Button, Input, Select } from '@/shared/ui/primitives';
import { accountLoginHref } from '@/modules/identity/logic/accountPaths';
import { CustomerSignInForm, type CustomerCheckoutSession } from '@/modules/identity/ui/CustomerSignInForm';
import accountStyles from '@/modules/identity/ui/account.module.css';
import type { CheckoutQuote } from '@/modules/orders/services/checkoutQuote';
import type { Locale } from '@/shared/lib/i18n';

interface CheckoutViewProps {
  locale: Locale;
  initialSession?: CustomerCheckoutSession;
}

interface PlacedOrder {
  orderId: number;
  orderNumber: string;
  sessionEstablished?: boolean;
  total?: number | null;
  status?: string | null;
  paymentStatus?: string | null;
  paymentMethod: PaymentMethod;
  fulfillment: (Pick<FulfillmentOption, 'method' | 'amount' | 'pickup'> & Partial<Pick<FulfillmentOption, 'label'>>) | null;
  shippingCity?: string | null;
  bankDetails?: CheckoutQuote['bankDetails'];
}

type FulfillmentOption = CheckoutQuote['fulfillment']['options'][number];
type FulfillmentSelection = Pick<FulfillmentOption, 'id' | 'method'>;
type PaymentMethod = CheckoutQuote['paymentMethods'][number];
type OrderResponse =
  | ({ success: true } & PlacedOrder)
  | { success: false; error?: string; code?: string; updatedQuote?: CheckoutQuote };

const quoteConflictCodes = ['PRICE_QUOTE_MISMATCH', 'FULFILLMENT_QUOTE_MISMATCH', 'SHIPPING_QUOTE_MISMATCH'];
const cartCorrectionCodes = [
  'MOQ_VIOLATION', 'PRODUCT_UNAVAILABLE', 'VARIANT_UNAVAILABLE', 'VARIANT_MISMATCH',
  'VARIANT_REQUIRED', 'PRICE_UNAVAILABLE', 'CUSTOMIZATION_UNAVAILABLE',
  'INVENTORY_UNINITIALIZED', 'INSUFFICIENT_STOCK', 'INVALID_QUANTITY',
];

const paymentLabels: Record<PaymentMethod, Record<Locale, string>> = {
  bank_transfer: { ar: 'تحويل بنكي رسمي للشركات', en: 'Corporate Bank Transfer' },
  cod: { ar: 'الدفع عند الاستلام', en: 'Cash on Delivery' },
};

const orderMessages: Record<string, Record<Locale, string>> = {
  INVALID_EMAIL: {
    ar: 'أدخل عنوان بريد إلكتروني صالحًا.',
    en: 'Enter a valid email address.',
  },
  MISSING_COMPANY_NAME: {
    ar: 'أدخل اسم الشركة.',
    en: 'Enter the company name.',
  },
  MISSING_CONTACT_PERSON: {
    ar: 'أدخل اسم مسؤول التواصل.',
    en: 'Enter the contact person’s name.',
  },
  MISSING_PHONE: {
    ar: 'أدخل رقم هاتف للتواصل.',
    en: 'Enter a contact phone number.',
  },
  PASSWORD_REQUIRED: {
    ar: 'أدخل كلمة مرور من ٨ إلى ١٢٨ حرفًا.',
    en: 'Enter a password between 8 and 128 characters.',
  },
  INCOMPLETE_SHIPPING_ADDRESS: {
    ar: 'أدخل المحافظة والمدينة وعنوان الشارع للتوصيل.',
    en: 'Enter the governorate, city and street address for delivery.',
  },
  BANK_TRANSFER_UNAVAILABLE: {
    ar: 'التحويل البنكي غير متاح لهذا الطلب. راجع طرق الدفع المتاحة.',
    en: 'Bank transfer is unavailable for this order. Review the available payment methods.',
  },
  COD_PROHIBITED_FOR_FULFILLMENT: {
    ar: 'الدفع عند الاستلام غير متاح لطريقة الاستلام المختارة. راجع طرق الدفع المتاحة.',
    en: 'Cash on delivery is unavailable for the selected fulfillment option. Review the available payment methods.',
  },
  FULFILLMENT_UNAVAILABLE: {
    ar: 'طريقة الاستلام غير متاحة. راجع العنوان وطرق الاستلام المتاحة.',
    en: 'The fulfillment option is unavailable. Review the address and available options.',
  },
};

const fulfillmentMessages: Record<NonNullable<CheckoutQuote['fulfillment']['issue']>, Record<Locale, string>> = {
  NO_APPROVED_FULFILLMENT: {
    ar: 'الشحن والاستلام غير متاحين حاليًا لهذا الطلب.',
    en: 'Delivery and pickup are currently unavailable for this order.',
  },
  UNSUPPORTED_DELIVERY_REGION: {
    ar: 'الشحن غير متاح لهذه المحافظة. يمكنك تغيير العنوان أو اختيار الاستلام إذا كان متاحًا.',
    en: 'We do not deliver to this governorate. Change the address or choose pickup if available.',
  },
  DELIVERY_REGION_REQUIRED: {
    ar: 'اختر المحافظة للتحقق من توفر الشحن والرسوم.',
    en: 'Choose a governorate to check delivery availability and fees.',
  },
  FULFILLMENT_SELECTION_REQUIRED: {
    ar: 'اختر طريقة الاستلام للمتابعة.',
    en: 'Choose a delivery or pickup option to continue.',
  },
  FULFILLMENT_OPTION_UNAVAILABLE: {
    ar: 'طريقة الاستلام التي اخترتها لم تعد متاحة. اختر إحدى الطرق المتاحة للمتابعة.',
    en: 'Your selected option is no longer available. Choose an available option to continue.',
  },
};

const unavailableAddressMessage: Record<Locale, string> = {
  ar: 'العنوان المحفوظ غير متاح. اختر عنوانًا آخر أو أدخل عنوانًا جديدًا.',
  en: 'This saved address is unavailable. Choose another address or enter a new one.',
};

function canShipToSavedAddress(address: CustomerCheckoutSession['addresses'][number]) {
  return address.country === 'EG' && Boolean(address.state?.trim() && address.city?.trim() && address.addressLine1?.trim());
}

export function CheckoutView({ locale, initialSession }: CheckoutViewProps) {
  const isArabic = locale === 'ar';
  const { cartId, items, isLoading, openCart, setShippingFee, resetSession, refreshCart } = useCart();
  const [quoteResult, setQuoteResult] = useState<{ key: string; cartId: number; items: typeof items; quote: CheckoutQuote } | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [quoteRetry, setQuoteRetry] = useState(0);
  const [customerSession, setCustomerSession] = useState(initialSession);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const signInHeading = useRef<HTMLHeadingElement>(null);
  const accountHeading = useRef<HTMLHeadingElement>(null);
  const signedInDuringCheckout = useRef(false);
  const savedAddresses = customerSession?.addresses.filter(canShipToSavedAddress) ?? [];
  const [savedAddressId, setSavedAddressId] = useState(initialSession?.profile.defaultAddressId ?? null);
  const savedAddress = savedAddresses.find((address) => address.id === savedAddressId);

  // Form State
  const [companyName, setCompanyName] = useState(initialSession?.profile.companyName ?? '');
  const [taxId, setTaxId] = useState(initialSession?.profile.taxId ?? '');
  const [contactName, setContactName] = useState(initialSession?.profile.name ?? '');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(initialSession?.profile.email ?? '');
  const [password, setPassword] = useState('');

  // Shipping Address Fields
  const [governorate, setGovernorate] = useState('');
  const [city, setCity] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [buildingDetails, setBuildingDetails] = useState('');
  const [fulfillmentNotes, setFulfillmentNotes] = useState('');

  const [fulfillmentSelection, setFulfillmentSelection] = useState<FulfillmentSelection | null>(null);
  const [paymentSelection, setPaymentSelection] = useState<PaymentMethod | null>(null);
  const [requiresReconfirmation, setRequiresReconfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOrderPlaced, setIsOrderPlaced] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const orderErrorRef = useRef<HTMLDivElement>(null);
  const addressErrorRef = useRef<HTMLDivElement>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const submittingOrder = useRef(false);
  const orderAttempt = useRef<{ cartId: number; key: string } | null>(null);

  const hasPhysicalItems = items.some((item) => item.itemType === 'physical');
  const addressId = savedAddress?.id;
  const destinationGovernorate = savedAddress?.state || governorate || undefined;
  const requestBody = JSON.stringify(hasPhysicalItems ? {
    delivery: {
      method: fulfillmentSelection?.method,
      optionId: fulfillmentSelection?.id,
      // Pickup needs no shipping address. Keep any destination solely to compare courier availability.
      ...(addressId && fulfillmentSelection?.method !== 'pickup'
        ? { addressId }
        : { governorate: destinationGovernorate }),
    },
  } : {});
  const quoteKey = `${cartId}|${customerSession?.profile.email ?? ''}|${quoteRetry}|${requestBody}`;
  const quote = quoteResult && quoteResult.cartId === cartId && quoteResult.items === items ? quoteResult.quote : null;
  const currentQuote = quoteResult && quoteResult.key === quoteKey && !isSignInOpen ? quote : null;
  const selectedOption = currentQuote?.fulfillment.selected;
  const paymentMethods = currentQuote?.paymentMethods ?? [];
  const bankTransferAvailable = paymentMethods.includes('bank_transfer');
  const paymentMethod = paymentSelection === null
    ? (bankTransferAvailable ? 'bank_transfer' : paymentMethods[0] ?? null)
    : (paymentMethods.includes(paymentSelection) ? paymentSelection : null);
  const formatAmount = (amount: number) => `${amount.toLocaleString(isArabic ? 'ar-EG' : 'en-EG')} ${isArabic ? 'ج.م' : 'EGP'}`;
  const needsDelivery = quote?.fulfillment.required ?? hasPhysicalItems;
  const canSubmit = Boolean(!isLoading && currentQuote?.canCheckout && currentQuote.confirmation
    && paymentMethod && (!needsDelivery || selectedOption));
  const shippingRegions = quote?.fulfillment.regions ?? [];
  const fulfillmentOptions = quote?.fulfillment.options ?? [];
  const fulfillmentIssue = currentQuote?.fulfillment.issue;
  const activeOptionId = currentQuote ? selectedOption?.id : fulfillmentSelection?.id;
  const showShippingAddress = currentQuote ? selectedOption?.method === 'shipping' : fulfillmentSelection?.method === 'shipping';
  const quoteBankDetails = currentQuote?.bankDetails;

  function changeDestination() {
    setAddressError(null);
    setOrderError(null);
    setQuoteError(null);
    if (fulfillmentSelection?.method === 'shipping') setFulfillmentSelection(null);
  }

  useEffect(() => {
    if (isSignInOpen) signInHeading.current?.focus();
    if (customerSession && signedInDuringCheckout.current) {
      accountHeading.current?.focus();
      signedInDuringCheckout.current = false;
    }
  }, [customerSession, isSignInOpen]);

  useEffect(() => {
    if ((orderError || quoteError) && !isSignInOpen && !isSubmitting) orderErrorRef.current?.focus();
  }, [orderError, quoteError, isSignInOpen, isSubmitting]);

  useEffect(() => {
    if (addressError) addressErrorRef.current?.focus();
  }, [addressError]);

  useEffect(() => {
    if (isOrderPlaced) confirmationHeading.current?.focus();
  }, [isOrderPlaced]);

  async function handleSignedIn(session: CustomerCheckoutSession) {
    setPassword('');
    setEmail(session.profile.email);
    setCompanyName((value) => value || session.profile.companyName || '');
    setTaxId((value) => value || session.profile.taxId || '');
    setContactName((value) => value || session.profile.name || '');
    setOrderError(null);
    await refreshCart();
    signedInDuringCheckout.current = true;
    setCustomerSession(session);
    setIsSignInOpen(false);
  }

  useEffect(() => {
    if (!cartId || items.length === 0 || isSignInOpen || isOrderPlaced) return;
    const controller = new AbortController();
    setQuoteError(null);
    setShippingFee(0);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/checkout/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
          signal: controller.signal,
        });
        const data: CheckoutQuote & { success?: boolean; error?: string } = await res.json();
        if (controller.signal.aborted) return;
        if (addressId && res.status === 404 && data.error?.startsWith('SAVED_ADDRESS_UNAVAILABLE:')) {
          setSavedAddressId(null);
          setFulfillmentSelection(null);
          setAddressError(unavailableAddressMessage[locale]);
          return;
        }
        if (!res.ok || !data.success) throw new Error('Quote unavailable');
        setQuoteResult({ key: quoteKey, cartId, items, quote: data });
        setShippingFee(data.shippingFee);
      } catch {
        if (!controller.signal.aborted) setQuoteError(isArabic
          ? 'تعذّر تحديث عرض الطلب. حاول مرة أخرى.'
          : 'We could not update your quote. Try again.');
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [addressId, cartId, isArabic, isOrderPlaced, isSignInOpen, items, locale, quoteKey, requestBody, setShippingFee]);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cartId || !currentQuote?.confirmation || !paymentMethod || !canSubmit || submittingOrder.current) return;

    // Preserve the order key if the request committed but the browser missed the response.
    if (orderAttempt.current?.cartId !== cartId) {
      orderAttempt.current = { cartId, key: generateOperationKey() };
    }
    const { key } = orderAttempt.current;

    submittingOrder.current = true;
    setIsSubmitting(true);
    setOrderError(null);

    try {
      const res = await fetch('/api/checkout/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify({
          locale,
          customer: {
            email,
            ...(customerSession ? {} : { password }),
            companyName,
            contactPerson: contactName,
            phone,
            taxId,
          },
          ...(selectedOption ? {
            delivery: {
              method: selectedOption.method,
              optionId: selectedOption.id,
              expectedFulfillmentConfirmation: selectedOption.confirmation,
              ...(selectedOption.method === 'shipping' && (addressId ? { addressId } : {
                shippingAddress: { governorate, city, streetAddress, buildingDetails },
              })),
              ...(selectedOption.method === 'pickup' && { comparisonGovernorate: destinationGovernorate }),
              fulfillmentNotes,
            },
          } : {}),
          paymentMethod,
          expectedCartId: cartId,
          expectedGrandTotal: currentQuote.grandTotal,
          expectedQuoteConfirmation: currentQuote.confirmation,
        }),
      });

      const data: OrderResponse = await res.json();
      if (!data.success) {
        const code = data.code ?? data.error?.split(':', 1)[0];
        if (code === 'EMAIL_ALREADY_REGISTERED') {
          setPassword('');
          setCustomerSession(undefined);
          setSavedAddressId(null);
          setIsSignInOpen(true);
          setOrderError(isArabic
            ? 'سجّل الدخول بهذا البريد الإلكتروني لإكمال طلبك.'
            : 'Sign in with this email address to continue your order.');
          return;
        }
        if (res.status === 404 && code === 'SAVED_ADDRESS_UNAVAILABLE') {
          setSavedAddressId(null);
          setFulfillmentSelection(null);
          setOrderError(unavailableAddressMessage[locale]);
          return;
        }
        if (res.status === 409 && code === 'CHECKOUT_CART_MISMATCH') {
          setPaymentSelection(paymentMethod);
          setRequiresReconfirmation(true);
          setOrderError(isArabic
            ? 'تغيّرت سلتك. راجع المنتجات والإجمالي المحدّث قبل تأكيد الطلب مجددًا.'
            : 'Your cart changed. Review the items and updated total before confirming again.');
          await refreshCart();
          setQuoteRetry((value) => value + 1);
          return;
        }
        if (res.status === 409 && (data.updatedQuote || (code && quoteConflictCodes.includes(code)))) {
          if (data.updatedQuote) {
            setQuoteResult({ key: quoteKey, cartId, items, quote: data.updatedQuote });
            setShippingFee(data.updatedQuote.shippingFee);
          } else {
            setQuoteRetry((value) => value + 1);
          }
          setPaymentSelection(paymentMethod);
          setRequiresReconfirmation(true);
          setOrderError(
            isArabic
              ? 'تغيّر عرض الطلب. راجع خيارات الاستلام والدفع والإجمالي المحدّث قبل تأكيد الطلب مجددًا.'
              : 'Your quote changed. Review the fulfillment and payment options and updated total before confirming again.'
          );
          return;
        }
        if (code === 'BANK_TRANSFER_UNAVAILABLE' || code === 'COD_PROHIBITED_FOR_FULFILLMENT') {
          setPaymentSelection(paymentMethod);
          setQuoteRetry((value) => value + 1);
        }
        if (code && cartCorrectionCodes.includes(code)) {
          setQuoteRetry((value) => value + 1);
          void refreshCart().catch(() => undefined);
          setOrderError(isArabic
            ? 'تغيّر توفر بعض المنتجات أو الحد الأدنى للطلب. راجع المنتجات والكميات في سلتك.'
            : 'Item availability or minimum quantities changed. Review the items and quantities in your cart.');
          return;
        }
        if (code && Object.hasOwn(orderMessages, code)) {
          setOrderError(orderMessages[code][locale]);
          return;
        }
        if (res.status === 409) setQuoteRetry((value) => value + 1);
        throw new Error('Order unavailable');
      }
      if (!res.ok) throw new Error('Order unavailable');

      setPlacedOrder({ ...data, bankDetails: currentQuote.bankDetails });
      setIsOrderPlaced(true);
      setPassword('');
      resetSession();
    } catch {
      setOrderError(isArabic
        ? 'تعذّر تأكيد الطلب. راجع التفاصيل ثم حاول مرة أخرى.'
        : 'We could not confirm your order. Review the details and try again.');
    } finally {
      submittingOrder.current = false;
      setIsSubmitting(false);
    }
  };

  if (isOrderPlaced && placedOrder) {
    const orderPath = `/${locale}/account/orders/${placedOrder.orderId}`;
    const canOpenOrder = customerSession || placedOrder.sessionEstablished;
    const orderHref = canOpenOrder ? orderPath : accountLoginHref(locale, orderPath);
    const fulfillment = placedOrder.fulfillment;
    const pickup = fulfillment?.pickup;
    const fulfillmentLabel = fulfillment?.label?.[locale] ?? (
      fulfillment?.method === 'shipping' ? (isArabic ? 'التوصيل إلى العنوان' : 'Courier delivery')
        : fulfillment?.method === 'pickup' ? (isArabic ? 'الاستلام' : 'Pickup')
          : (isArabic ? 'تنفيذ الخدمة' : 'Service fulfillment')
    );
    const bankDetails = placedOrder.bankDetails;
    return (
      <div className="container" style={{ paddingBlock: '5rem 7rem', maxWidth: '740px', textAlign: 'center' }}>
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--status-success-bg)',
            color: 'var(--status-success)',
            fontSize: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            border: '2px solid var(--status-success)',
          }}
        >
          ✓
        </div>

        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {isArabic ? 'تم اعتماد وتأكيد أمر الشراء المؤسسي بنجاح' : 'Corporate Order Placed Successfully'}
        </span>

        <h1 ref={confirmationHeading} tabIndex={-1} style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0.5rem 0 1rem' }}>
          {placedOrder.orderNumber}
        </h1>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.7, marginBottom: '2rem' }}>
          {isArabic
            ? 'تم حفظ وتسجيل تفاصيل طلبكم وتجميد الأسعار ورسوم الطباعة بدقة داخل النظام، وربط ملفات الشعار المرفقة بالطلب.'
            : 'Your order snapshot, pricing, customization fees, and uploaded assets have been securely frozen in the database.'}
        </p>

        <div
          style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            marginBottom: '2rem',
            textAlign: isArabic ? 'right' : 'left',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{isArabic ? 'رقم الطلب الرسمي:' : 'Order Number:'}</span>
            <span style={{ fontWeight: 700, color: 'var(--brand-primary-dark)' }}>{placedOrder.orderNumber}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{isArabic ? 'الجهة المتعاقدة:' : 'Corporate Entity:'}</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{companyName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{isArabic ? 'طريقة الاستلام:' : 'Fulfillment:'}</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {fulfillmentLabel}
              {placedOrder.shippingCity && ` (${placedOrder.shippingCity})`}
            </span>
          </div>
          {placedOrder.fulfillment && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{isArabic ? 'رسوم الاستلام:' : 'Fulfillment fee:'}</span>
              <span>{formatAmount(placedOrder.fulfillment.amount)}</span>
            </div>
          )}
          {pickup && (
            <div style={{ marginBottom: '0.75rem', whiteSpace: 'pre-line' }}>
              <p>{pickup.address[locale]}</p>
              <p>{pickup.instructions[locale]}</p>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{isArabic ? 'طريقة السداد:' : 'Payment Method:'}</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {paymentLabels[placedOrder.paymentMethod]?.[locale] ?? '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{isArabic ? 'حالة الطلب:' : 'Order Status:'}</span>
            <Badge variant="info">{placedOrder.status || 'pending'}</Badge>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{isArabic ? 'حالة السداد:' : 'Payment Status:'}</span>
            <Badge variant="warning">{placedOrder.paymentMethod === 'cod' && (placedOrder.paymentStatus ?? 'unpaid') === 'unpaid'
              ? (isArabic ? 'بانتظار التحصيل النقدي' : 'Awaiting cash collection')
              : placedOrder.paymentStatus || 'unpaid'}</Badge>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>{isArabic ? 'الإجمالي النهائي المجمد:' : 'Frozen Grand Total:'}</span>
            <span style={{ fontWeight: 700, color: 'var(--brand-primary-dark)', fontSize: '1.125rem' }}>
              {placedOrder.total != null ? formatAmount(placedOrder.total) : '—'}
            </span>
          </div>
        </div>

        {placedOrder.paymentMethod === 'bank_transfer' && (
          <div
            style={{
              textAlign: isArabic ? 'right' : 'left',
              padding: '1.25rem',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '2rem',
              fontSize: '0.875rem',
            }}
          >
            <div style={{ fontWeight: 700, color: 'var(--brand-primary-dark)', marginBottom: '0.5rem', fontSize: '0.9375rem' }}>
              {isArabic ? 'تعليمات السداد والتحويل البنكي المؤسسي:' : 'Corporate Bank Wire & Payment Instructions:'}
            </div>
            {bankDetails?.status === 'active' ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  {bankDetails.bankName && (
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>{isArabic ? 'اسم البنك' : 'Bank'}</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{bankDetails.bankName}</strong>
                    </div>
                  )}
                  {bankDetails.accountName && (
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>{isArabic ? 'المستفيد' : 'Beneficiary'}</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{bankDetails.accountName}</strong>
                    </div>
                  )}
                  {bankDetails.accountNumber && (
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>{isArabic ? 'رقم الحساب' : 'Account Number'}</span>
                      <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{bankDetails.accountNumber}</strong>
                    </div>
                  )}
                  {bankDetails.iban && (
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>IBAN</span>
                      <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{bankDetails.iban}</strong>
                    </div>
                  )}
                  {bankDetails.swiftCode && (
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>SWIFT</span>
                      <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{bankDetails.swiftCode}</strong>
                    </div>
                  )}
                  {bankDetails.instapayHandle && (
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Instapay</span>
                      <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{bankDetails.instapayHandle}</strong>
                    </div>
                  )}
                </div>
                {bankDetails.bankInstructions && (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
                    {bankDetails.bankInstructions}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {isArabic
                  ? 'تم تسجيل طلبكم بنجاح. سيتم تزويدكم ببيانات التحويل البنكي والتنسيق المالي مع الفاتورة المعتمدة بعد مراجعة الإدارة المالية لضمان سلامة الإجراءات قبل الإطلاق الرسمي.'
                  : 'Your order has been registered. Official bank wire coordinates and financial invoice coordination will be provided directly following finance department review.'}
              </div>
            )}
            <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {isArabic
                ? 'بعد إتمام التحويل، يرجى تقديم إشعار الإيداع البنكي ورقم المرجع عبر مسار مراجعة المدفوعات لاعتماد الإنتاج والتسليم.'
                : 'After completing the transfer, please submit the deposit slip and reference code via the payment review portal for production and dispatch clearance.'}
            </div>
          </div>
        )}

        {placedOrder.paymentMethod === 'cod' && (placedOrder.paymentStatus ?? 'unpaid') === 'unpaid' && (
          <p style={{ color: 'var(--text-secondary)', marginBlockEnd: '1.5rem' }}>
            {fulfillment?.method === 'pickup'
              ? (isArabic ? 'ادفع نقدًا عند استلام طلبك من نقطة الاستلام.' : 'Pay cash when you pick up your order.')
              : (isArabic ? 'ادفع نقدًا لمندوب الشحن عند تسلّم طلبك.' : 'Pay cash to the courier when you receive your order.')}
          </p>
        )}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href={orderHref} prefetch={false} className="btn-primary btn-md">
            {canOpenOrder
              ? (isArabic ? 'عرض تفاصيل الطلب' : 'View order details')
              : (isArabic ? 'تسجيل الدخول لمتابعة الطلب' : 'Sign in to view your order')}
          </Link>
          <Link
            href={isArabic ? '/ar/store' : '/en/store'}
            className="btn-outline"
            style={{
              display: 'inline-block',
              padding: '0.85rem 2rem',
              textDecoration: 'none',
              fontWeight: 700,
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {isArabic ? 'متابعة تصفح المتجر والخدمات ←' : 'Return to Catalog →'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingBlock: '3.5rem 6rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
          {isArabic ? 'الخطوة 2 // إتمام الطلب والتعاقد' : 'STEP 2 // B2B CHECKOUT & INVOICING'}
        </span>
        <h1 style={{ fontSize: 'clamp(1.85rem, 3vw, 2.5rem)', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0.35rem 0 1rem' }}>
          {isArabic ? 'إتمام طلب الشراء المؤسسي (B2B)' : 'Corporate Order Checkout'}
        </h1>
      </header>

      {!customerSession && (
        <section className={`${accountStyles.panel} ${accountStyles.stack}`} style={{ marginBlockEnd: '2rem' }}>
          <div className={accountStyles.row}>
            <h2 ref={signInHeading} tabIndex={-1}>{isArabic ? 'هل لديك حساب؟' : 'Already have an account?'}</h2>
            <Button variant="outline" size="sm" aria-expanded={isSignInOpen} aria-controls="checkout-sign-in"
              disabled={isSubmitting}
              onClick={() => setIsSignInOpen(!isSignInOpen)}>
              {isSignInOpen ? (isArabic ? 'متابعة بدون تسجيل الدخول' : 'Continue without signing in') : (isArabic ? 'تسجيل الدخول' : 'Sign in')}
            </Button>
          </div>
          <div id="checkout-sign-in" hidden={!isSignInOpen}>
            {isSignInOpen && (
              <div className={accountStyles.stack}>
                {orderError && <Alert variant="warning">{orderError}</Alert>}
                <CustomerSignInForm locale={locale} returnTo={`/${locale}/checkout`} defaultEmail={email} onSignedIn={handleSignedIn} />
              </div>
            )}
          </div>
        </section>
      )}

      {((!isLoading && items.length === 0) || Boolean(currentQuote?.validationErrors.length)) && (
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--status-warning-bg)',
            border: '1px solid var(--status-warning)',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: 'var(--status-warning)', fontSize: '0.9375rem', marginBottom: '0.25rem' }}>
              {items.length === 0
                ? (isArabic ? 'سلة التسوق فارغة' : 'Your cart is empty')
                : (isArabic ? 'راجع المنتجات والكميات في سلتك' : 'Review items and quantities in your cart')}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              {items.length > 0 && (isArabic
                ? 'تحقق من توفر المنتجات والحد الأدنى للكمية لكل منتج.'
                : 'Check availability and the minimum quantity for each product.')}
            </div>
            {currentQuote?.items.filter((item) => item.stockIssue).map((item) => item.stockIssue && (
              <p key={item.id} style={{ fontSize: '0.8125rem', color: 'var(--status-warning)' }}>
                <strong>{item.title}{item.variantTitle ? ` (${item.variantTitle})` : ''}</strong>{' '}
                {stockNotice(item.stockIssue, locale)}
              </p>
            ))}
          </div>

          {items.length > 0 ? (
            <Button variant="secondary" size="sm" type="button" onClick={openCart}>
              {isArabic ? 'تعديل السلة' : 'Edit cart'}
            </Button>
          ) : (
            <Link
              href={isArabic ? '/ar/store' : '/en/store'}
              className="btn-secondary"
              style={{ padding: '0.5rem 1rem', textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 600 }}
            >
              {isArabic ? 'متابعة التسوق' : 'Continue shopping'}
            </Link>
          )}
        </div>
      )}

      {/* 2-Column Checkout Grid */}
      <form onSubmit={handleSubmitOrder}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '3rem', alignItems: 'start' }}>
          {/* Left Column: Form Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* 1. Company Information */}
            <div style={{ padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-surface)' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0 0 1.25rem' }}>
                {isArabic ? '1. بيانات الشركة والجهة المتعاقدة' : '1. Corporate Entity Details'}
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div>
                  <label htmlFor="checkout-company-name" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)', marginBottom: '0.35rem' }}>
                    {isArabic ? 'اسم الشركة / المؤسسة *' : 'Company Name *'}
                  </label>
                  <input
                    id="checkout-company-name"
                    type="text"
                    autoComplete="organization"
                    disabled={isSubmitting}
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder={isArabic ? 'شركة النيل للحلول الرقمية' : 'Nile Digital Solutions LLC'}
                    style={{ width: '100%', padding: '0.625rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
                  />
                </div>

                <div>
                  <label htmlFor="checkout-tax-id" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)', marginBottom: '0.35rem' }}>
                    {isArabic ? 'السجل التجاري أو الرقم الضريبي (اختياري)' : 'Commercial Register / Tax ID (Optional)'}
                  </label>
                  <input
                    id="checkout-tax-id"
                    type="text"
                    disabled={isSubmitting}
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder="123-456-789"
                    style={{ width: '100%', padding: '0.625rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
                  />
                </div>

                <div>
                  <label htmlFor="checkout-contact-name" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)', marginBottom: '0.35rem' }}>
                    {isArabic ? 'اسم المسؤول التنفيذي *' : 'Authorized Contact Person *'}
                  </label>
                  <input
                    id="checkout-contact-name"
                    type="text"
                    autoComplete="name"
                    disabled={isSubmitting}
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder={isArabic ? 'أحمد الشناوي' : 'Ahmed El Shennawy'}
                    style={{ width: '100%', padding: '0.625rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
                  />
                </div>

                <div>
                  <label htmlFor="checkout-phone" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)', marginBottom: '0.35rem' }}>
                    {isArabic ? 'رقم الهاتف للتواصل والمتابعة *' : 'Phone Number *'}
                  </label>
                  <input
                    id="checkout-phone"
                    type="tel"
                    autoComplete="tel"
                    disabled={isSubmitting}
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+20 100 000 0000"
                    style={{ width: '100%', padding: '0.625rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="checkout-email" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)', marginBottom: '0.35rem' }}>
                    {isArabic ? 'البريد الإلكتروني المؤسسي *' : 'Corporate Email Address *'}
                  </label>
                  <input
                    id="checkout-email"
                    type="email"
                    autoComplete="email"
                    disabled={isSubmitting}
                    required
                    readOnly={Boolean(customerSession)}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="purchasing@company.com"
                    style={{ width: '100%', padding: '0.625rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
                  />
                </div>
              </div>
            </div>

            {/* 2. Seamless Account Setup */}
            <div style={{ padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-surface)' }}>
              <h2 ref={accountHeading} tabIndex={-1} style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0 0 0.5rem' }}>
                {isArabic ? '2. إعداد حساب العميل لمتابعة الشحنات' : '2. Direct Account Access'}
              </h2>
              {customerSession ? (
                <div className={accountStyles.stack}>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {isArabic ? 'تم تسجيل الدخول. سيظهر الطلب في حسابك بعد التأكيد.' : 'Signed in. The order will appear in your account after confirmation.'}
                  </p>
                  <Link href={`/${locale}/account/orders`} prefetch={false}>{isArabic ? 'عرض طلباتي' : 'View my orders'}</Link>
                </div>
              ) : (
                <>
                  <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {isArabic
                      ? 'سننشئ حسابك عند تأكيد الطلب. اختر كلمة مرور من ٨ أحرف على الأقل لمتابعة طلبك.'
                      : 'Your account is created when you confirm the order. Choose a password of at least 8 characters to track your order.'}
                  </p>
                  <div>
                    <label htmlFor="checkout-account-password" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)', marginBottom: '0.35rem' }}>
                      {isArabic ? 'كلمة المرور *' : 'Account Password *'}
                    </label>
                    <input
                      id="checkout-account-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      required
                      disabled={isSubmitting}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ width: '100%', padding: '0.625rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
                    />
                  </div>
                </>
              )}
            </div>

            {(needsDelivery || items.length === 0) && (
              <section aria-labelledby="checkout-fulfillment-heading" className={`${accountStyles.panel} ${accountStyles.stack}`}>
                <h2 id="checkout-fulfillment-heading" style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: 0 }}>
                  {isArabic ? 'طريقة الاستلام والتوصيل' : 'Delivery Method'}
                </h2>

                {addressError && (
                  <div ref={addressErrorRef} tabIndex={-1}>
                    <Alert variant="warning">{addressError}</Alert>
                  </div>
                )}

                {shippingRegions.length > 0 && (
                  <div className={accountStyles.stack}>
                    {savedAddresses.length > 0 && (
                      <Select
                        label={isArabic ? 'عنوان التوصيل المحفوظ' : 'Saved delivery address'}
                        value={addressId ?? ''}
                        disabled={isSubmitting || isSignInOpen}
                        onChange={(event) => {
                          changeDestination();
                          setSavedAddressId(event.target.value ? Number(event.target.value) : null);
                        }}
                      >
                        <option value="">{isArabic ? 'إدخال عنوان جديد' : 'Enter a new address'}</option>
                        {savedAddresses.map((address) => (
                          <option key={address.id} value={address.id}>
                            {address.title || `${address.addressLine1}, ${address.city}`}
                            {address.id === customerSession?.profile.defaultAddressId && (isArabic ? ' (افتراضي)' : ' (default)')}
                          </option>
                        ))}
                      </Select>
                    )}
                    {savedAddress ? (
                      <address className={`${accountStyles.address} ${accountStyles.muted}`}>
                        {[savedAddress.addressLine1, savedAddress.addressLine2, savedAddress.city, savedAddress.state].filter(Boolean).join(isArabic ? '، ' : ', ')}
                      </address>
                    ) : (
                      <Select
                        id="checkout-governorate"
                        label={isArabic ? 'محافظة التوصيل' : 'Delivery governorate'}
                        helperText={isArabic ? 'الشحن متاح للمحافظات المدرجة فقط.' : 'Delivery is available to the listed governorates.'}
                        autoComplete="address-level1"
                        value={governorate}
                        disabled={isSubmitting || isSignInOpen}
                        onChange={(event) => {
                          changeDestination();
                          setGovernorate(event.target.value);
                        }}
                      >
                        <option value="">{isArabic ? 'اختر المحافظة' : 'Select a governorate'}</option>
                        {shippingRegions.map((region) => (
                          <option key={region.code} value={region.code}>{region.label[locale]}</option>
                        ))}
                      </Select>
                    )}
                  </div>
                )}

                {fulfillmentOptions.length > 0 && (
                  <fieldset
                    aria-labelledby="checkout-fulfillment-heading"
                    disabled={!currentQuote || isSubmitting}
                    className={accountStyles.stack}
                    style={{ border: 0, padding: 0, margin: 0, minInlineSize: 0 }}
                  >
                    {fulfillmentOptions.map((option) => (
                      <label
                        key={option.id}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.875rem',
                          borderRadius: 'var(--radius-sm)',
                          border: `1px solid var(${activeOptionId === option.id ? '--brand-primary' : '--border-default'})`,
                          backgroundColor: activeOptionId === option.id ? 'var(--status-info-bg)' : 'var(--bg-primary)',
                        }}
                      >
                        <input
                          type="radio"
                          name="delivery"
                          value={option.id}
                          checked={activeOptionId === option.id}
                          style={{ marginBlockStart: '0.25rem' }}
                          onChange={() => {
                            setOrderError(null);
                            setFulfillmentSelection({ id: option.id, method: option.method });
                          }}
                        />
                        <span style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', flex: 1 }}>
                          <strong>{option.label[locale]}</strong>
                          <span>{formatAmount(option.amount)}</span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                )}

                {fulfillmentIssue && (
                  <Alert variant={fulfillmentOptions.length > 0 ? 'info' : 'warning'}>
                    {fulfillmentMessages[fulfillmentIssue][locale]}
                  </Alert>
                )}

                {selectedOption?.method === 'pickup' && savedAddress && shippingRegions.length > 0 &&
                  !fulfillmentOptions.some((option) => option.method === 'shipping') && (
                    <Alert>{fulfillmentMessages.UNSUPPORTED_DELIVERY_REGION[locale]}</Alert>
                  )}

                {showShippingAddress && !savedAddress && (
                  <div className={accountStyles.stack}>
                    <Input label={isArabic ? 'المدينة / المنطقة' : 'City / District'} autoComplete="address-level2"
                      disabled={isSubmitting} required value={city} onChange={(event) => setCity(event.target.value)} />
                    <Input label={isArabic ? 'الشارع والعنوان بالتفصيل' : 'Street address'} autoComplete="address-line1"
                      disabled={isSubmitting} required value={streetAddress} onChange={(event) => setStreetAddress(event.target.value)} />
                    <Input label={isArabic ? 'تفاصيل المبنى / الطابق / رقم المكتب' : 'Building / Floor / Office'} autoComplete="address-line2"
                      disabled={isSubmitting} value={buildingDetails} onChange={(event) => setBuildingDetails(event.target.value)} />
                  </div>
                )}

                {selectedOption?.pickup && (
                  <Alert title={isArabic ? 'تفاصيل الاستلام' : 'Pickup details'}>
                    <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{selectedOption.pickup.address[locale]}</p>
                    <p style={{ margin: '0.35rem 0 0', whiteSpace: 'pre-line' }}>{selectedOption.pickup.instructions[locale]}</p>
                  </Alert>
                )}

                {selectedOption && (
                  <div>
                    <label htmlFor="checkout-fulfillment-notes" className="form-label">
                      {isArabic ? 'ملاحظات الاستلام أو التوصيل (اختياري)' : 'Delivery or pickup notes (optional)'}
                    </label>
                    <textarea
                      id="checkout-fulfillment-notes"
                      rows={2}
                      disabled={isSubmitting}
                      value={fulfillmentNotes}
                      onChange={(event) => setFulfillmentNotes(event.target.value)}
                      style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
                    />
                  </div>
                )}
              </section>
            )}

            {/* 4. Payment Method Selection */}
            <div style={{ padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-surface)' }}>
              <h2 id="checkout-payment-heading" style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0 0 1rem' }}>
                {isArabic ? '4. طريقة السداد المالي' : '4. Payment Method'}
              </h2>

              <fieldset
                aria-labelledby="checkout-payment-heading"
                disabled={isSubmitting}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', border: 0, padding: 0, margin: 0, minInlineSize: 0 }}
              >
                {paymentMethods.map((method) => (
                  <label
                    key={method}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '0.85rem', padding: '1rem',
                      borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      border: paymentMethod === method ? '2px solid var(--brand-primary)' : '1px solid var(--border-default)',
                      backgroundColor: paymentMethod === method ? 'var(--status-info-bg)' : 'var(--bg-primary)',
                    }}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={method}
                      checked={paymentMethod === method}
                      onChange={() => setPaymentSelection(method)}
                      style={{ marginBlockStart: '0.25rem' }}
                    />
                    <strong>{paymentLabels[method][locale]}</strong>
                  </label>
                ))}

                {paymentMethod === 'cod' && (
                  <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                    {selectedOption?.method === 'pickup'
                      ? (isArabic ? 'السداد نقدًا عند استلام الطلب من نقطة الاستلام.' : 'Pay cash when you pick up your order.')
                      : (isArabic ? 'السداد نقدًا لمندوب الشحن عند تسلّم الطلب.' : 'Pay cash to the courier on delivery.')}
                  </p>
                )}

                {paymentMethod === 'bank_transfer' && quoteBankDetails?.status === 'active' && (
                  <div
                    style={{
                      padding: '1rem',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8125rem',
                      marginBottom: '0.25rem',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: 'var(--brand-primary-dark)', marginBottom: '0.5rem' }}>
                      {isArabic ? 'بيانات التحويل البنكي' : 'Bank transfer details'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {quoteBankDetails.bankName && (
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>{isArabic ? 'البنك' : 'Bank'}</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{quoteBankDetails.bankName}</strong>
                        </div>
                      )}
                      {quoteBankDetails.accountName && (
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>{isArabic ? 'المستفيد' : 'Beneficiary'}</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{quoteBankDetails.accountName}</strong>
                        </div>
                      )}
                      {quoteBankDetails.accountNumber && (
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>{isArabic ? 'رقم الحساب' : 'Account No.'}</span>
                          <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{quoteBankDetails.accountNumber}</strong>
                        </div>
                      )}
                      {quoteBankDetails.iban && (
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>IBAN</span>
                          <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{quoteBankDetails.iban}</strong>
                        </div>
                      )}
                      {quoteBankDetails.swiftCode && (
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>SWIFT</span>
                          <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{quoteBankDetails.swiftCode}</strong>
                        </div>
                      )}
                      {quoteBankDetails.instapayHandle && (
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Instapay</span>
                          <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{quoteBankDetails.instapayHandle}</strong>
                        </div>
                      )}
                    </div>
                    {quoteBankDetails.bankInstructions && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
                        {quoteBankDetails.bankInstructions}
                      </div>
                    )}
                  </div>
                )}

                {currentQuote && paymentMethods.length === 0 && (!needsDelivery || selectedOption) && (
                  <Alert variant="warning">
                    {isArabic ? 'لا توجد طريقة دفع متاحة لهذا الطلب حاليًا.' : 'No payment method is currently available for this order.'}
                  </Alert>
                )}
                {paymentMethods.length > 0 && !paymentMethod && (
                  <Alert variant="warning">
                    {isArabic ? 'طريقة الدفع السابقة لم تعد متاحة. اختر إحدى الطرق المتاحة للمتابعة.' : 'Your previous payment method is unavailable. Choose an available method to continue.'}
                  </Alert>
                )}
              </fieldset>
            </div>
          </div>

          {/* Right Column: Sticky Immutable Order Summary */}
          <div
            style={{
              position: 'sticky',
              top: '2rem',
              padding: '1.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-surface)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0 0 1.25rem' }}>
              {isArabic ? 'ملخص أمر الشراء المعتمد' : 'Immutable Order Summary'}
            </h2>

            {/* Itemized List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem', maxHeight: '300px', overflowY: 'auto' }}>
              {(currentQuote?.items ?? []).map((line) => {
                const title = line.title;
                const variantName = line.variantTitle;
                const lineTotal = line.lineTotal;

                return (
                  <div
                    key={line.id}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-secondary)',
                      fontSize: '0.8125rem',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--brand-primary-dark)' }}>
                      <span>{title}</span>
                      <span>{formatAmount(lineTotal)}</span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {line.quantity} {isArabic ? 'قطع' : 'units'} {variantName ? `• ${variantName}` : ''}
                    </div>
                    {line.lineCustomizationFee > 0 && (
                      <div style={{ color: 'var(--brand-primary)', marginTop: '0.15rem' }}>
                        {isArabic ? 'التخصيص' : 'Customization'} (+{formatAmount(line.lineCustomizationFee)})
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Calculations Breakdown */}
            <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>{isArabic ? 'إجمالي المنتجات الأساسية:' : 'Base Products Subtotal:'}</span>
                <span>{currentQuote ? formatAmount(currentQuote.subtotal) : '—'}</span>
              </div>

              {currentQuote && currentQuote.totalCustomizationFees > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>{isArabic ? 'رسوم الطباعة والتخصيص:' : 'Customization & Branding:'}</span>
                  <span>{formatAmount(currentQuote.totalCustomizationFees)}</span>
                </div>
              )}

              {needsDelivery && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>{isArabic ? 'رسوم الشحن أو الاستلام' : 'Delivery or pickup fee'}</span>
                  <span>{currentQuote && selectedOption ? formatAmount(currentQuote.shippingFee) : '—'}</span>
                </div>
              )}

              {currentQuote && currentQuote.taxAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>{isArabic ? 'الضريبة' : 'Tax'}</span>
                  <span>{formatAmount(currentQuote.taxAmount)}</span>
                </div>
              )}

              {items.length > 0 && !currentQuote && !quoteError && !isSignInOpen && (
                <p role="status" style={{ color: 'var(--text-secondary)', margin: 0 }}>
                  {isArabic ? 'جارٍ تحديث عرض الطلب…' : 'Updating your quote…'}
                </p>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: 'var(--brand-primary-dark)',
                  borderTop: '2px solid var(--border-default)',
                  paddingTop: '0.75rem',
                  marginTop: '0.5rem',
                }}
              >
                <span>{isArabic ? 'الإجمالي' : 'Total'}</span>
                <span>{currentQuote && (!needsDelivery || selectedOption) ? formatAmount(currentQuote.grandTotal) : '—'}</span>
              </div>
            </div>

            {/* Error Message Display */}
            {(orderError || quoteError) && (
              <div
                ref={orderErrorRef}
                tabIndex={-1}
                role="alert"
                style={{
                  marginTop: '1.25rem',
                  padding: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--status-error-bg)',
                  border: '1px solid var(--status-error)',
                  color: 'var(--status-error)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  lineHeight: 1.5,
                }}
              >
                {orderError || quoteError}
              </div>
            )}

            {quoteError && (
              <Button variant="outline" size="sm" type="button" onClick={() => setQuoteRetry((value) => value + 1)} style={{ marginBlockStart: '0.75rem' }}>
                {isArabic ? 'تحديث عرض الطلب' : 'Retry quote'}
              </Button>
            )}

            {/* Submit Action */}
            <div style={{ marginTop: '1.5rem' }}>
              <Button
                variant="primary"
                size="lg"
                type="submit"
                disabled={!canSubmit || isSubmitting}
                loading={isSubmitting}
                loadingText={isArabic ? 'جاري تأكيد وتسجيل الطلب...' : 'Processing Order...'}
                onClick={(event) => {
                  if (event.detail > 1) event.preventDefault();
                }}
                style={{ width: '100%', fontWeight: 700 }}
              >
                {requiresReconfirmation && currentQuote?.confirmation
                  ? (isArabic
                    ? `تأكيد الطلب بالإجمالي المحدّث ${formatAmount(currentQuote.grandTotal)}`
                    : `Confirm order at updated total of ${formatAmount(currentQuote.grandTotal)}`)
                  : (isArabic ? 'تأكيد أمر الشراء المؤسسي (B2B) ←' : 'Confirm B2B Corporate Order →')}
              </Button>
            </div>

            <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              🔒 {isArabic ? 'عملية شراء مشفرة وآمنة وفق ضوابط التعاقد المؤسسي D-007 و D-013' : 'Secure corporate order process compliant with D-007 & D-013'}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
