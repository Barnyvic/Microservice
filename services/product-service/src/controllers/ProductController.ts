import type { Request, Response } from 'express';
import { ProductService } from '../services/ProductService';
import { asyncHandler } from '@shared/middleware/error-handler';
import { logger } from '@shared/utils/logger';
import type { ExtendedRequest } from '../interfaces';

export class ProductController {
  private productService: ProductService;

  constructor() {
    this.productService = new ProductService();
  }

  
  createProduct = asyncHandler(async (req: ExtendedRequest, res: Response) => {
    const product = await this.productService.createProduct(
      req.body,
      req.requestId
    );

    logger.info('Product created via API', {
      productId: product.productId,
      requestId: req.requestId,
    });

    res.status(201).json({
      success: true,
      data: product,
    });
  });

  
  getProduct = asyncHandler(async (req: ExtendedRequest, res: Response) => {
    const { productId } = req.params;

    const product = await this.productService.getProductById(
      productId,
      req.requestId
    );

    res.json({
      success: true,
      data: product,
    });
  });

  
  updateProduct = asyncHandler(async (req: ExtendedRequest, res: Response) => {
    const { productId } = req.params;

    const product = await this.productService.updateProduct(
      productId,
      req.body,
      req.requestId
    );

    logger.info('Product updated via API', {
      productId,
      requestId: req.requestId,
    });

    res.json({
      success: true,
      data: product,
    });
  });

  
  deleteProduct = asyncHandler(async (req: ExtendedRequest, res: Response) => {
    const { productId } = req.params;

    await this.productService.deleteProduct(productId, req.requestId);

    logger.info('Product deleted via API', {
      productId,
      requestId: req.requestId,
    });

    res.status(204).send();
  });

  
  listProducts = asyncHandler(async (req: ExtendedRequest, res: Response) => {
    const {
      page = 1,
      limit = 10,
      category,
      brand,
      minPrice,
      maxPrice,
      search,
    } = req.query;

    const result = await this.productService.listProducts(
      {
        page: Number(page),
        limit: Number(limit),
        category: category as string,
        brand: brand as string,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        search: search as string,
      },
      req.requestId
    );

    res.json({
      success: true,
      data: result.products,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  });

  
  checkAvailability = asyncHandler(
    async (req: ExtendedRequest, res: Response) => {
      const { productId } = req.params;
      const { quantity = 1 } = req.query;

      const result = await this.productService.checkAvailability(
        productId,
        Number(quantity),
        req.requestId
      );

      res.json({
        success: true,
        data: result,
      });
    }
  );

  
  reserveStock = asyncHandler(async (req: ExtendedRequest, res: Response) => {
    const { productId } = req.params;
    const { quantity } = req.body;

    const success = await this.productService.reserveStock(
      productId,
      quantity,
      req.requestId
    );

    res.json({
      success,
      data: { reserved: success },
    });
  });

  
  releaseStock = asyncHandler(async (req: ExtendedRequest, res: Response) => {
    const { productId } = req.params;
    const { quantity } = req.body;

    await this.productService.releaseStock(productId, quantity, req.requestId);

    res.json({
      success: true,
      data: { released: true },
    });
  });

  
  getProductsByCategory = asyncHandler(
    async (req: ExtendedRequest, res: Response) => {
      const { category } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const result = await this.productService.getProductsByCategory(
        category,
        {
          page: Number(page),
          limit: Number(limit),
        },
        req.requestId
      );

      res.json({
        success: true,
        data: result.products,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    }
  );

  
  getProductsByBrand = asyncHandler(
    async (req: ExtendedRequest, res: Response) => {
      const { brand } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const result = await this.productService.getProductsByBrand(
        brand,
        {
          page: Number(page),
          limit: Number(limit),
        },
        req.requestId
      );

      res.json({
        success: true,
        data: result.products,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    }
  );

  
  searchProducts = asyncHandler(async (req: ExtendedRequest, res: Response) => {
    const { q: searchTerm, page = 1, limit = 10 } = req.query;

    if (!searchTerm || typeof searchTerm !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Search term is required',
      });
    }

    const result = await this.productService.searchProducts(
      searchTerm,
      {
        page: Number(page),
        limit: Number(limit),
      },
      req.requestId
    );

    res.json({
      success: true,
      data: result.products,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  });
}


