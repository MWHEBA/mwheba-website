import * as migration_20261103_013744_baseline_foundation from './20261103_013744_baseline_foundation';
import * as migration_20261104_110000_b2b05_fulfillment_jobs_and_briefs from './20261104_110000_b2b05_fulfillment_jobs_and_briefs';
import * as migration_20261104_120000_b2b05_creative_role_and_unique_brief from './20261104_120000_b2b05_creative_role_and_unique_brief';
import * as migration_20261103_013844_add_categories from './20261103_013844_add_categories';
import * as migration_20261103_035158_add_localized_pages_and_blocks from './20261103_035158_add_localized_pages_and_blocks';
import * as migration_20261103_042157_add_navigation_global from './20261103_042157_add_navigation_global';
import * as migration_20261103_044622_add_portfolio_projects from './20261103_044622_add_portfolio_projects';
import * as migration_20261103_095701_add_blog_posts from './20261103_095701_add_blog_posts';
import * as migration_20261103_122500_add_inquiries_and_settings from './20261103_122500_add_inquiries_and_settings';
import * as migration_20261103_140000_extend_products_b2b from './20261103_140000_extend_products_b2b';
import * as migration_20261103_160000_add_cart_idempotency from './20261103_160000_add_cart_idempotency';
import * as migration_20261103_170000_preserve_guest_secrets_and_schema from './20261103_170000_preserve_guest_secrets_and_schema';
import * as migration_20261104_080000_add_artwork_assets_b2b from './20261104_080000_add_artwork_assets_b2b';
import * as migration_20261104_083000_update_artwork_scan_status_default from './20261104_083000_update_artwork_scan_status_default';
import * as migration_20261104_090000_add_order_snapshots_b2b from './20261104_090000_add_order_snapshots_b2b';
import * as migration_20261104_100000_add_order_cart_link_and_idempotency from './20261104_100000_add_order_cart_link_and_idempotency';

export const migrations = [
  {
    up: migration_20261103_013744_baseline_foundation.up,
    down: migration_20261103_013744_baseline_foundation.down,
    name: '20261103_013744_baseline_foundation',
  },
  {
    up: migration_20261103_013844_add_categories.up,
    down: migration_20261103_013844_add_categories.down,
    name: '20261103_013844_add_categories',
  },
  {
    up: migration_20261103_035158_add_localized_pages_and_blocks.up,
    down: migration_20261103_035158_add_localized_pages_and_blocks.down,
    name: '20261103_035158_add_localized_pages_and_blocks',
  },
  {
    up: migration_20261103_042157_add_navigation_global.up,
    down: migration_20261103_042157_add_navigation_global.down,
    name: '20261103_042157_add_navigation_global',
  },
  {
    up: migration_20261103_044622_add_portfolio_projects.up,
    down: migration_20261103_044622_add_portfolio_projects.down,
    name: '20261103_044622_add_portfolio_projects',
  },
  {
    up: migration_20261103_095701_add_blog_posts.up,
    down: migration_20261103_095701_add_blog_posts.down,
    name: '20261103_095701_add_blog_posts'
  },
  {
    up: migration_20261103_122500_add_inquiries_and_settings.up,
    down: migration_20261103_122500_add_inquiries_and_settings.down,
    name: '20261103_122500_add_inquiries_and_settings'
  },
  {
    up: migration_20261103_140000_extend_products_b2b.up,
    down: migration_20261103_140000_extend_products_b2b.down,
    name: '20261103_140000_extend_products_b2b'
  },
  {
    up: migration_20261103_160000_add_cart_idempotency.up,
    down: migration_20261103_160000_add_cart_idempotency.down,
    name: '20261103_160000_add_cart_idempotency'
  },
  {
    up: migration_20261103_170000_preserve_guest_secrets_and_schema.up,
    down: migration_20261103_170000_preserve_guest_secrets_and_schema.down,
    name: '20261103_170000_preserve_guest_secrets_and_schema'
  },
  {
    up: migration_20261104_080000_add_artwork_assets_b2b.up,
    down: migration_20261104_080000_add_artwork_assets_b2b.down,
    name: '20261104_080000_add_artwork_assets_b2b',
  },
  {
    up: migration_20261104_083000_update_artwork_scan_status_default.up,
    down: migration_20261104_083000_update_artwork_scan_status_default.down,
    name: '20261104_083000_update_artwork_scan_status_default',
  },
  {
    up: migration_20261104_090000_add_order_snapshots_b2b.up,
    down: migration_20261104_090000_add_order_snapshots_b2b.down,
    name: '20261104_090000_add_order_snapshots_b2b',
  },
  {
    up: migration_20261104_100000_add_order_cart_link_and_idempotency.up,
    down: migration_20261104_100000_add_order_cart_link_and_idempotency.down,
    name: '20261104_100000_add_order_cart_link_and_idempotency',
  },
  {
    up: migration_20261104_110000_b2b05_fulfillment_jobs_and_briefs.up,
    down: migration_20261104_110000_b2b05_fulfillment_jobs_and_briefs.down,
    name: '20261104_110000_b2b05_fulfillment_jobs_and_briefs',
  },
  {
    up: migration_20261104_120000_b2b05_creative_role_and_unique_brief.up,
    down: migration_20261104_120000_b2b05_creative_role_and_unique_brief.down,
    name: '20261104_120000_b2b05_creative_role_and_unique_brief',
  },
];
