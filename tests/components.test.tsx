import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  Button,
  Input,
  Textarea,
  Select,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
  Alert,
  QuantityStepper,
} from '@/shared/ui/primitives';

describe('DES-03: Core UI Component Library (Primitives)', () => {
  describe('Button Component', () => {
    it('renders native button with default primary variant and medium size', () => {
      const html = renderToString(<Button>Confirm Order</Button>);
      expect(html).toContain('<button');
      expect(html).toContain('class="btn-primary btn-md"');
      expect(html).toContain('Confirm Order');
      expect(html).toContain('type="button"');
    });

    it('renders different variants, sizes, and custom types', () => {
      const html = renderToString(
        <Button variant="accent" size="lg" type="submit">
          Save Changes
        </Button>
      );
      expect(html).toContain('class="btn-accent btn-lg"');
      expect(html).toContain('type="submit"');
    });

    it('handles disabled state properly with native disabled attribute and aria-disabled', () => {
      const html = renderToString(<Button disabled>Disabled Action</Button>);
      expect(html).toContain('disabled=""');
      expect(html).toContain('aria-disabled="true"');
    });

    it('handles loading state with aria-busy, disabled attribute, and custom loading text', () => {
      const html = renderToString(
        <Button loading loadingText="Processing Transfer...">
          Submit Payment
        </Button>
      );
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('disabled=""');
      expect(html).toContain('aria-disabled="true"');
      expect(html).toContain('Processing Transfer...');
      expect(html).not.toContain('Submit Payment');
    });
  });

  describe('Input & Form Controls', () => {
    it('renders native input and associates label via htmlFor and id', () => {
      const html = renderToString(
        <Input id="customer-name" label="Customer Name" placeholder="Enter name" required />
      );
      expect(html).toContain('<label for="customer-name" class="form-label"');
      expect(html).toContain('<input id="customer-name"');
      expect(html).toContain('placeholder="Enter name"');
      expect(html).toContain('required=""');
    });

    it('associates error messages using aria-describedby, aria-invalid, and role="alert"', () => {
      const html = renderToString(
        <Input
          id="po-number"
          label="Purchase Order"
          error="PO Number must be at least 6 digits"
        />
      );
      expect(html).toContain('aria-invalid="true"');
      expect(html).toContain('aria-describedby="po-number-error"');
      expect(html).toContain('id="po-number-error"');
      expect(html).toContain('class="form-error"');
      expect(html).toContain('role="alert"');
      expect(html).toContain('PO Number must be at least 6 digits');
      expect(html).toContain('class="form-input has-error"');
    });

    it('associates helper text when no error exists', () => {
      const html = renderToString(
        <Input
          id="tax-id"
          label="Tax ID"
          helperText="Standard 9-digit Egyptian tax registration"
        />
      );
      expect(html).toContain('aria-describedby="tax-id-helper"');
      expect(html).toContain('id="tax-id-helper"');
      expect(html).toContain('class="form-helper"');
      expect(html).toContain('Standard 9-digit Egyptian tax registration');
      expect(html).not.toContain('aria-invalid');
    });

    it('renders Textarea with native textarea element, rows, and linked error message', () => {
      const html = renderToString(
        <Textarea
          id="artwork-notes"
          label="Artwork Instructions"
          rows={6}
          error="Instructions cannot exceed 500 characters"
        />
      );
      expect(html).toContain('<textarea id="artwork-notes"');
      expect(html).toContain('rows="6"');
      expect(html).toContain('aria-invalid="true"');
      expect(html).toContain('aria-describedby="artwork-notes-error"');
      expect(html).toContain('id="artwork-notes-error"');
      expect(html).toContain('role="alert"');
    });

    it('renders Select with options and native select element', () => {
      const options = [
        { value: 'egp', label: 'EGP - Egyptian Pound' },
        { value: 'usd', label: 'USD - US Dollar' },
      ];
      const html = renderToString(
        <Select id="currency-select" label="Billing Currency" options={options} />
      );
      expect(html).toContain('<select id="currency-select"');
      expect(html).toContain('<option value="egp">EGP - Egyptian Pound</option>');
      expect(html).toContain('<option value="usd">USD - US Dollar</option>');
    });
  });

  describe('Badge Component', () => {
    it('renders badge with correct variant classes', () => {
      const htmlNeutral = renderToString(<Badge variant="neutral">Draft</Badge>);
      expect(htmlNeutral).toContain('class="badge badge-neutral"');
      expect(htmlNeutral).toContain('Draft');

      const htmlWarning = renderToString(<Badge variant="warning">MOQ: 10</Badge>);
      expect(htmlWarning).toContain('class="badge badge-warning"');
      expect(htmlWarning).toContain('MOQ: 10');

      const htmlSuccess = renderToString(<Badge variant="success">Confirmed</Badge>);
      expect(htmlSuccess).toContain('class="badge badge-success"');
    });
  });

  describe('Card Component Family', () => {
    it('renders card structure with header, title, body, and footer', () => {
      const html = renderToString(
        <Card as="article">
          <CardHeader>
            <CardTitle as="h2">Thermal Mug</CardTitle>
          </CardHeader>
          <CardBody>
            <p>500ml double-wall mug.</p>
          </CardBody>
          <CardFooter>
            <Button>Add</Button>
          </CardFooter>
        </Card>
      );
      expect(html).toContain('<article class="card"');
      expect(html).toContain('<div class="card-header"');
      expect(html).toContain('<h2 class="card-title">Thermal Mug</h2>');
      expect(html).toContain('<div class="card-body"');
      expect(html).toContain('<div class="card-footer"');
    });
  });

  describe('Alert Component', () => {
    it('assigns role="alert" for error and warning alerts', () => {
      const htmlWarning = renderToString(
        <Alert variant="warning" title="Shortage Warning">
          Cart MOQ of 10 not met.
        </Alert>
      );
      expect(htmlWarning).toContain('class="alert-warning"');
      expect(htmlWarning).toContain('role="alert"');
      expect(htmlWarning).toContain('Shortage Warning');
      expect(htmlWarning).toContain('Cart MOQ of 10 not met.');

      const htmlError = renderToString(
        <Alert variant="error">
          Payment processing failed.
        </Alert>
      );
      expect(htmlError).toContain('class="alert-error"');
      expect(htmlError).toContain('role="alert"');
    });

    it('assigns role="status" for success and info alerts', () => {
      const htmlSuccess = renderToString(
        <Alert variant="success" title="Success">
          Bank slip approved.
        </Alert>
      );
      expect(htmlSuccess).toContain('class="alert-success"');
      expect(htmlSuccess).toContain('role="status"');
    });
  });

  describe('QuantityStepper Component', () => {
    it('renders spinbutton input with minus and plus controls', () => {
      const html = renderToString(
        <QuantityStepper defaultValue={10} min={1} max={100} id="mug-quantity" />
      );
      expect(html).toContain('role="group"');
      expect(html).toContain('<input type="text"');
      expect(html).toContain('pattern="[0-9]*"');
      expect(html).toContain('role="spinbutton"');
      expect(html).toContain('aria-valuenow="10"');
      expect(html).toContain('aria-valuemin="1"');
      expect(html).toContain('aria-valuemax="100"');
      expect(html).toContain('value="10"');
    });

    it('disables decrement button when current value equals min', () => {
      const html = renderToString(<QuantityStepper defaultValue={1} min={1} max={50} />);
      // Find the decrement button HTML
      const decrementMatch = html.match(/<button[^>]*aria-label="Decrease quantity"[^>]*>/);
      expect(decrementMatch).toBeDefined();
      expect(decrementMatch![0]).toContain('disabled=""');

      const incrementMatch = html.match(/<button[^>]*aria-label="Increase quantity"[^>]*>/);
      expect(incrementMatch).toBeDefined();
      expect(incrementMatch![0]).not.toContain('disabled=""');
    });

    it('disables increment button when current value equals max', () => {
      const html = renderToString(<QuantityStepper defaultValue={50} min={1} max={50} />);
      const incrementMatch = html.match(/<button[^>]*aria-label="Increase quantity"[^>]*>/);
      expect(incrementMatch).toBeDefined();
      expect(incrementMatch![0]).toContain('disabled=""');

      const decrementMatch = html.match(/<button[^>]*aria-label="Decrease quantity"[^>]*>/);
      expect(decrementMatch).toBeDefined();
      expect(decrementMatch![0]).not.toContain('disabled=""');
    });

    it('disables all controls when disabled prop is true', () => {
      const html = renderToString(<QuantityStepper defaultValue={5} disabled />);
      const decrementMatch = html.match(/<button[^>]*aria-label="Decrease quantity"[^>]*>/);
      expect(decrementMatch![0]).toContain('disabled=""');

      const incrementMatch = html.match(/<button[^>]*aria-label="Increase quantity"[^>]*>/);
      expect(incrementMatch![0]).toContain('disabled=""');

      const inputMatch = html.match(/<input[^>]*role="spinbutton"[^>]*>/);
      expect(inputMatch![0]).toContain('disabled=""');
    });
  });
});
