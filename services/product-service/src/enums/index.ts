/**
 * Product service specific enums
 */

/**
 * Product availability status
 */
export enum ProductAvailabilityStatus {
  IN_STOCK = 'in_stock',
  OUT_OF_STOCK = 'out_of_stock',
  LOW_STOCK = 'low_stock',
  DISCONTINUED = 'discontinued',
  COMING_SOON = 'coming_soon',
}

/**
 * Product condition enum
 */
export enum ProductCondition {
  NEW = 'new',
  REFURBISHED = 'refurbished',
  USED = 'used',
  DAMAGED = 'damaged',
}

/**
 * Product visibility status
 */
export enum ProductVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  DRAFT = 'draft',
  ARCHIVED = 'archived',
}

/**
 * Stock movement type for inventory tracking
 */
export enum StockMovementType {
  PURCHASE = 'purchase',
  SALE = 'sale',
  RETURN = 'return',
  ADJUSTMENT = 'adjustment',
  DAMAGE = 'damage',
  TRANSFER = 'transfer',
}

/**
 * Product sort options
 */
export enum ProductSortBy {
  NAME = 'name',
  PRICE = 'price',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  POPULARITY = 'popularity',
  RATING = 'rating',
}

/**
 * Sort order enum
 */
export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}
